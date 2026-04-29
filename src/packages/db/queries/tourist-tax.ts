"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"

// ─── Types ──────────────────────────────────────────────────────────────────────

type TouristTaxConfig = {
  tourist_tax_enabled: boolean
  tourist_tax_rate: number
  tourist_tax_max_nights: number
  tourist_tax_child_exempt_age: number
  tourist_tax_exempt_residents: boolean
  tourist_tax_exempt_ota_channels: string[]
  tourist_tax_municipality: string | null
  tourist_tax_catastale_code: string | null
}

type TaxCalculationResult = {
  applied: boolean
  reason?: string
  totalGuests: number
  taxableGuests: number
  exemptGuests: number
  chargeableNights: number
  ratePerPerson: number
  totalAmount: number
}

// ─── Settings ───────────────────────────────────────────────────────────────────

export async function saveTouristTaxSettings(
  propertyId: string,
  settings: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = await createClient()

  // Merge into existing properties.settings JSONB
  const { data: property } = await supabase
    .from("properties")
    .select("settings")
    .eq("id", propertyId)
    .single()

  const currentSettings = (property?.settings ?? {}) as Record<string, unknown>
  const merged = { ...currentSettings, ...settings }

  const { error } = await supabase
    .from("properties")
    .update({ settings: merged })
    .eq("id", propertyId)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  revalidatePath("/tassa-soggiorno")
  revalidatePath("/dashboard")
  return success(undefined)
}

export async function getTouristTaxConfig(): Promise<TouristTaxConfig | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("property_id")
    .eq("id", user.id)
    .single()
  if (!profile?.property_id) return null

  const { data: property } = await supabase
    .from("properties")
    .select("settings")
    .eq("id", profile.property_id)
    .single()

  const s = (property?.settings ?? {}) as Record<string, unknown>

  return {
    tourist_tax_enabled: (s.tourist_tax_enabled as boolean) ?? false,
    tourist_tax_rate: (s.tourist_tax_rate as number) ?? 0,
    tourist_tax_max_nights: (s.tourist_tax_max_nights as number) ?? 10,
    tourist_tax_child_exempt_age: (s.tourist_tax_child_exempt_age as number) ?? 10,
    tourist_tax_exempt_residents: (s.tourist_tax_exempt_residents as boolean) ?? false,
    tourist_tax_exempt_ota_channels: (s.tourist_tax_exempt_ota_channels as string[]) ?? [],
    tourist_tax_municipality: (s.tourist_tax_municipality as string) ?? null,
    tourist_tax_catastale_code: (s.tourist_tax_catastale_code as string) ?? null,
  }
}

// ─── Calculation Engine ─────────────────────────────────────────────────────────

/**
 * Calcola e applica la tassa di soggiorno automaticamente.
 * Va chiamata dopo il check-in. È idempotente (aggiorna se già presente).
 *
 * La tassa di soggiorno NON è soggetta a IVA (tax_rate = 0).
 */
export async function calculateAndApplyTouristTax(
  bookingId: string
): Promise<ActionResult<TaxCalculationResult>> {
  const supabase = await createClient()

  // 1. Carica booking
  const { data: booking, error: bookingErr } = await supabase
    .from("bookings")
    .select("id, nights, check_in, channel_id, property_id")
    .eq("id", bookingId)
    .single()

  if (bookingErr || !booking) return failure("Prenotazione non trovata")

  // 2. Carica config tassa dalla property
  const { data: property } = await supabase
    .from("properties")
    .select("settings")
    .eq("id", booking.property_id)
    .single()

  const s = (property?.settings ?? {}) as Record<string, unknown>
  const config: TouristTaxConfig = {
    tourist_tax_enabled: (s.tourist_tax_enabled as boolean) ?? false,
    tourist_tax_rate: (s.tourist_tax_rate as number) ?? 0,
    tourist_tax_max_nights: (s.tourist_tax_max_nights as number) ?? 10,
    tourist_tax_child_exempt_age: (s.tourist_tax_child_exempt_age as number) ?? 10,
    tourist_tax_exempt_residents: (s.tourist_tax_exempt_residents as boolean) ?? false,
    tourist_tax_exempt_ota_channels: (s.tourist_tax_exempt_ota_channels as string[]) ?? [],
    tourist_tax_municipality: (s.tourist_tax_municipality as string) ?? null,
    tourist_tax_catastale_code: (s.tourist_tax_catastale_code as string) ?? null,
  }

  // 3. Verifica se abilitata
  if (!config.tourist_tax_enabled || config.tourist_tax_rate <= 0) {
    return success({
      applied: false,
      reason: "Tassa di soggiorno non abilitata",
      totalGuests: 0, taxableGuests: 0, exemptGuests: 0,
      chargeableNights: 0, ratePerPerson: 0, totalAmount: 0,
    })
  }

  // 4. Verifica esenzione canale OTA (es. Airbnb raccoglie la tassa direttamente)
  if (booking.channel_id && config.tourist_tax_exempt_ota_channels.includes(booking.channel_id)) {
    return success({
      applied: false,
      reason: "Canale OTA esente (la piattaforma raccoglie la tassa direttamente)",
      totalGuests: 0, taxableGuests: 0, exemptGuests: 0,
      chargeableNights: 0, ratePerPerson: config.tourist_tax_rate, totalAmount: 0,
    })
  }

  // 5. Carica ospiti della prenotazione con data di nascita
  const { data: bookingGuests } = await supabase
    .from("booking_guests")
    .select("guest_id, type, guests:guest_id(date_of_birth, city)")
    .eq("booking_id", bookingId)

  // Se non ci sono booking_guests, usa adults/children dal booking
  let taxableGuests = 0
  let exemptGuests = 0
  let totalGuests = 0

  if (bookingGuests && bookingGuests.length > 0) {
    // Calcolo basato sugli ospiti registrati al check-in
    for (const bg of bookingGuests) {
      totalGuests++
      const guestRaw = bg.guests as unknown
      const guest = (Array.isArray(guestRaw) ? guestRaw[0] : guestRaw) as { date_of_birth: string | null; city: string | null } | null

      // Controllo età
      if (guest?.date_of_birth && config.tourist_tax_child_exempt_age > 0) {
        const age = calculateAgeAtDate(guest.date_of_birth, booking.check_in)
        if (age < config.tourist_tax_child_exempt_age) {
          exemptGuests++
          continue
        }
      }

      // Controllo residenza
      if (
        config.tourist_tax_exempt_residents &&
        config.tourist_tax_municipality &&
        guest?.city
      ) {
        if (guest.city.toLowerCase().trim() === config.tourist_tax_municipality.toLowerCase().trim()) {
          exemptGuests++
          continue
        }
      }

      taxableGuests++
    }
  } else {
    // Fallback: usa adults dal booking (children sotto l'età sono esenti)
    const { data: bookingData } = await supabase
      .from("bookings")
      .select("adults, children")
      .eq("id", bookingId)
      .single()

    taxableGuests = bookingData?.adults ?? 1
    totalGuests = taxableGuests + (bookingData?.children ?? 0)
    exemptGuests = bookingData?.children ?? 0
  }

  // 6. Calcola notti tassabili
  const chargeableNights = Math.min(booking.nights ?? 1, config.tourist_tax_max_nights)

  // 7. Calcola importo totale
  const totalAmount = taxableGuests * chargeableNights * config.tourist_tax_rate

  if (totalAmount <= 0) {
    return success({
      applied: false,
      reason: "Nessun ospite tassabile",
      totalGuests, taxableGuests: 0, exemptGuests: totalGuests,
      chargeableNights, ratePerPerson: config.tourist_tax_rate, totalAmount: 0,
    })
  }

  // 8. Trova il folio della prenotazione
  const { data: folio } = await supabase
    .from("folios")
    .select("id")
    .eq("booking_id", bookingId)
    .single()

  if (!folio) return failure("Folio non trovato per la prenotazione")

  // 9. Cerca se esiste già un invoice_item per la tassa di soggiorno
  const { data: existingItem } = await supabase
    .from("invoice_items")
    .select("id")
    .eq("folio_id", folio.id)
    .eq("category", "TassaSoggiorno")
    .maybeSingle()

  const description = `Tassa di soggiorno (${taxableGuests} ${taxableGuests === 1 ? "ospite" : "ospiti"} × ${chargeableNights} ${chargeableNights === 1 ? "notte" : "notti"})`
  const quantity = taxableGuests * chargeableNights

  if (existingItem) {
    // Aggiorna esistente
    const { error: updateErr } = await supabase
      .from("invoice_items")
      .update({
        description,
        quantity,
        unit_price: config.tourist_tax_rate,
        tax_rate: 0, // La tassa di soggiorno NON è soggetta a IVA
      })
      .eq("id", existingItem.id)

    if (updateErr) return failure(`Errore aggiornamento tassa: ${updateErr.message}`)
  } else {
    // Crea nuovo
    const { error: insertErr } = await supabase
      .from("invoice_items")
      .insert({
        folio_id: folio.id,
        description,
        category: "TassaSoggiorno",
        quantity,
        unit_price: config.tourist_tax_rate,
        tax_rate: 0, // La tassa di soggiorno NON è soggetta a IVA
        date: booking.check_in,
      })

    if (insertErr) return failure(`Errore inserimento tassa: ${insertErr.message}`)
  }

  revalidatePath(`/bookings/${bookingId}`)

  return success({
    applied: true,
    totalGuests,
    taxableGuests,
    exemptGuests,
    chargeableNights,
    ratePerPerson: config.tourist_tax_rate,
    totalAmount,
  })
}

// ─── Report per Comune ──────────────────────────────────────────────────────────

export async function getTouristTaxReport(month: string) {
  const supabase = await createClient()

  const startDate = `${month}-01`
  const endDate = new Date(
    parseInt(month.split("-")[0]),
    parseInt(month.split("-")[1]),
    0
  ).toISOString().split("T")[0]

  // Prendi tutti gli invoice_items con categoria TassaSoggiorno nel periodo
  const { data: items, error } = await supabase
    .from("invoice_items")
    .select(`
      id, description, quantity, unit_price, total_gross, date,
      folio:folio_id (
        id,
        booking:booking_id (
          id,
          booking_number,
          check_in,
          check_out,
          nights,
          adults,
          children,
          status,
          guest:guest_id (full_name),
          channel:channel_id (name)
        )
      )
    `)
    .eq("category", "TassaSoggiorno")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })

  if (error) return failure(error.message)

  // Aggregazioni
  const totalCollected = (items ?? []).reduce((sum, i) => sum + Number(i.total_gross ?? 0), 0)
  const totalBookings = new Set((items ?? []).map(i => {
    const folioRaw = i.folio as unknown
    const folio = (Array.isArray(folioRaw) ? folioRaw[0] : folioRaw) as { booking: unknown } | null
    const bookingRaw = folio?.booking
    const booking = (Array.isArray(bookingRaw) ? bookingRaw[0] : bookingRaw) as { id: string } | null
    return booking?.id
  }).filter(Boolean)).size
  const totalTaxablePersonNights = (items ?? []).reduce((sum, i) => sum + Number(i.quantity ?? 0), 0)

  return success({
    items: items ?? [],
    summary: {
      totalCollected,
      totalBookings,
      totalTaxablePersonNights,
      month,
    },
  })
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function calculateAgeAtDate(birthDateStr: string, referenceDate: string): number {
  const birth = new Date(birthDateStr)
  const ref = new Date(referenceDate)
  let age = ref.getFullYear() - birth.getFullYear()
  const monthDiff = ref.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < birth.getDate())) {
    age--
  }
  return age
}
