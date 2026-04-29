"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"
import {
  login,
  getCodiciIstat,
  getUltimaRilevazione,
  postMovimentazione,
  formatDateIstat,
  type IstatCredentials,
} from "@istat/index"
import { buildGiornate, type BookingForIstat } from "@istat/movimentazione-builder"
import type { Giornata } from "@istat/types"

// ============================================
// Credenziali
// ============================================

async function getCredentials(): Promise<ActionResult<IstatCredentials>> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from("profiles")
    .select("property_id")
    .eq("id", (await supabase.auth.getUser()).data.user?.id || "")
    .single()

  if (!profile) return failure("Profilo non trovato")

  const { data: property } = await supabase
    .from("properties")
    .select("settings")
    .eq("id", profile.property_id)
    .single()

  if (!property) return failure("Struttura non trovata")

  const settings = (property.settings || {}) as Record<string, string | boolean>

  if (!settings.istat_cusr || !settings.istat_apikey) {
    return failure("Credenziali ISTAT non configurate. Vai in Impostazioni per configurarle.")
  }

  return success({
    cusr: settings.istat_cusr as string,
    apiKey: settings.istat_apikey as string,
    useSandbox: settings.istat_sandbox !== false, // default: sandbox
  })
}

// ============================================
// Salva credenziali
// ============================================

export async function saveIstatSettings(
  propertyId: string,
  settings: {
    istat_cusr: string
    istat_apikey: string
    istat_sandbox: boolean
  }
): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: property } = await supabase
    .from("properties")
    .select("settings")
    .eq("id", propertyId)
    .single()

  if (!property) return failure("Struttura non trovata")

  const currentSettings = (property.settings || {}) as Record<string, unknown>

  const newSettings = {
    ...currentSettings,
    ...settings,
  }

  const { error } = await supabase
    .from("properties")
    .update({ settings: newSettings })
    .eq("id", propertyId)

  if (error) return failure(error.message)

  revalidatePath("/settings")
  return success(undefined)
}

// ============================================
// Test connessione
// ============================================

export async function testIstatConnection(): Promise<ActionResult<{ message: string }>> {
  const credsResult = await getCredentials()
  if (credsResult.error || !credsResult.data) return failure(credsResult.error || "Credenziali mancanti")
  const creds = credsResult.data

  try {
    const token = await login(creds)
    const codici = await getCodiciIstat(token.accessToken, creds.useSandbox)
    const ultima = await getUltimaRilevazione(token.accessToken, creds.useSandbox)

    return success({
      message: `Connessione riuscita! ${codici.province?.length || 0} province, ${codici.nazioni?.length || 0} nazioni caricate. Ultima rilevazione: ${ultima.dataUltimaRilevazione || "nessuna"}`,
    })
  } catch (err) {
    return failure(`Errore di connessione: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ============================================
// Anteprima movimentazione
// ============================================

export async function buildMovimentazionePreview(
  dateFrom: string, // YYYY-MM-DD
  dateTo: string     // YYYY-MM-DD
): Promise<ActionResult<Giornata[]>> {
  const supabase = await createClient()

  // Bookings nel range con ospiti
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id, check_in, check_out, room_id, status,
      booking_guests (
        guest:guest_id (citizenship, province_of_birth)
      )
    `)
    .or(`check_in.gte.${dateFrom},check_out.lte.${dateTo}`)
    .in("status", ["CheckedIn", "CheckedOut"])

  if (error) return failure(error.message)

  // Trasforma in formato builder
  const bookingsForIstat: BookingForIstat[] = (bookings || []).map((b) => ({
    id: b.id,
    check_in: b.check_in,
    check_out: b.check_out,
    room_id: b.room_id,
    status: b.status,
    guests: ((b.booking_guests || []) as unknown as Array<{ guest: { citizenship: string | null; province_of_birth: string | null } | { citizenship: string | null; province_of_birth: string | null }[] | null }>).map((bg) => {
      // Supabase può restituire array o oggetto per i join
      const g = Array.isArray(bg.guest) ? bg.guest[0] : bg.guest
      return {
        citizenship: g?.citizenship || null,
        province_of_birth: g?.province_of_birth || null,
      }
    }),
  }))

  const from = new Date(dateFrom)
  const to = new Date(dateTo)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return failure("Formato data non valido. Usa YYYY-MM-DD")
  }
  const giornate = buildGiornate(from, to, bookingsForIstat)

  return success(giornate)
}

// ============================================
// Invio movimentazione
// ============================================

export async function sendMovimentazione(
  dateFrom: string,
  dateTo: string
): Promise<ActionResult<{ giornateInviate: number }>> {
  const supabase = await createClient()

  // Credenziali
  const credsResult = await getCredentials()
  if (credsResult.error || !credsResult.data) return failure(credsResult.error || "Credenziali mancanti")
  const creds = credsResult.data

  // Costruisci giornate
  const previewResult = await buildMovimentazionePreview(dateFrom, dateTo)
  if (previewResult.error || !previewResult.data) return failure(previewResult.error || "Dati mancanti")
  const giornate = previewResult.data

  if (giornate.length === 0) return failure("Nessuna giornata da inviare")

  try {
    // Login
    const token = await login(creds)

    // Invio
    await postMovimentazione(token.accessToken, creds.useSandbox, giornate)

    // Salva in istat_submissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("property_id")
      .eq("id", (await supabase.auth.getUser()).data.user?.id || "")
      .single()

    if (profile) {
      const user = await supabase.auth.getUser()

      for (const g of giornate) {
        // Parse DDMMYYYY → YYYY-MM-DD per il DB
        const dd = g.dataRilevazione.slice(0, 2)
        const mm = g.dataRilevazione.slice(2, 4)
        const yyyy = g.dataRilevazione.slice(4, 8)
        const dbDate = `${yyyy}-${mm}-${dd}`

        await supabase
          .from("istat_submissions")
          .upsert({
            property_id: profile.property_id,
            data_rilevazione: dbDate,
            camere_occupate: g.camereOccupate,
            giornate: g as unknown as Record<string, unknown>,
            response_status: 201,
            submitted_by: user.data.user?.id || null,
          }, {
            onConflict: "property_id,data_rilevazione",
          })
      }
    }

    revalidatePath("/istat")
    return success({ giornateInviate: giornate.length })
  } catch (err) {
    return failure(`Errore invio: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ============================================
// Storico invii
// ============================================

export async function getIstatHistory(
  dateFrom?: string,
  dateTo?: string
): Promise<ActionResult<Array<{
  data_rilevazione: string
  camere_occupate: number
  giornate: unknown
  response_status: number | null
  submitted_at: string
}>>> {
  const supabase = await createClient()

  let query = supabase
    .from("istat_submissions")
    .select("data_rilevazione, camere_occupate, giornate, response_status, submitted_at")
    .order("data_rilevazione", { ascending: false })
    .limit(60)

  if (dateFrom) query = query.gte("data_rilevazione", dateFrom)
  if (dateTo) query = query.lte("data_rilevazione", dateTo)

  const { data, error } = await query

  if (error) return failure(error.message)
  return success(data || [])
}
