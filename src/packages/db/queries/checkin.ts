"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"
import {
  generateToken,
  authenticationTest,
  testSchedine as soapTestSchedine,
  sendSchedine as soapSendSchedine,
  buildElencoSchedine,
  validateElenco,
  type DatiSchedina,
  type AlloggiatiCredentials,
  CODICE_ITALIA,
  TIPO_ALLOGGIATO,
} from "@alloggiati/index"

// ── Helpers ──────────────────────────────────

/** Converte gg/mm/aaaa → YYYY-MM-DD per PostgreSQL. Se già ISO, restituisce invariato. */
function itDateToIso(d: string): string {
  const m = d.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return d  // già ISO o altro formato
}

// ============================================
// Read
// ============================================

/**
 * Carica tutti i dati necessari per la pagina check-in:
 * booking, ospite primario, accompagnatori esistenti, storico invii.
 */
export async function getCheckInData(bookingId: string) {
  const supabase = await createClient()

  // Booking con guest e room
  const { data: booking, error: bErr } = await supabase
    .from("bookings")
    .select(`
      *,
      guest:guest_id (*),
      room_type:room_type_id (id, name, short_code),
      room:room_id (id, name),
      channel:channel_id (id, name)
    `)
    .eq("id", bookingId)
    .single()

  if (bErr || !booking) return failure("Prenotazione non trovata")

  // Accompagnatori già salvati
  const { data: bookingGuests } = await supabase
    .from("booking_guests")
    .select(`
      *,
      guest:guest_id (*)
    `)
    .eq("booking_id", bookingId)
    .order("is_primary", { ascending: false })

  // Storico invii Alloggiati
  const { data: submissions } = await supabase
    .from("alloggiati_submissions")
    .select("*")
    .eq("booking_id", bookingId)
    .order("submitted_at", { ascending: false })

  // Property settings (per credenziali Alloggiati)
  const { data: property } = await supabase
    .from("properties")
    .select("id, settings")
    .eq("id", booking.property_id)
    .single()

  const settings = (property?.settings || {}) as Record<string, string>
  const hasCredentials = !!(
    settings.alloggiati_username &&
    settings.alloggiati_password &&
    settings.alloggiati_wskey
  )

  return success({
    booking,
    bookingGuests: bookingGuests || [],
    submissions: submissions || [],
    hasCredentials,
  })
}

// ============================================
// Salva dati ospiti (bozza)
// ============================================

/**
 * Aggiorna i campi Alloggiati sull'ospite principale.
 */
export async function updateGuestAlloggiatiFields(
  guestId: string,
  fields: {
    first_name: string
    last_name: string
    gender: string
    date_of_birth: string
    place_of_birth: string
    province_of_birth?: string
    country_of_birth: string
    citizenship: string
    document_type?: string
    document_number?: string
    document_issued_by?: string
  }
): Promise<ActionResult> {
  const supabase = await createClient()

  // Aggiorna anche full_name per consistenza
  const full_name = `${fields.first_name} ${fields.last_name}`.trim()

  // Converte data gg/mm/aaaa → YYYY-MM-DD per PostgreSQL
  const dbDate = itDateToIso(fields.date_of_birth) || fields.date_of_birth

  const { error } = await supabase
    .from("guests")
    .update({
      full_name,
      first_name: fields.first_name,
      last_name: fields.last_name,
      gender: fields.gender,
      date_of_birth: dbDate,
      place_of_birth: fields.place_of_birth,
      province_of_birth: fields.province_of_birth || null,
      country_of_birth: fields.country_of_birth,
      citizenship: fields.citizenship,
      document_type: fields.document_type || null,
      document_number: fields.document_number || null,
      document_issued_by: fields.document_issued_by || null,
    })
    .eq("id", guestId)

  if (error) return failure(error.message)

  revalidatePath("/bookings")
  revalidatePath("/guests")
  return success(undefined)
}

/**
 * Salva gli accompagnatori per un booking.
 * Crea nuovi guest nel DB se necessario, poi upsert in booking_guests.
 */
export async function saveBookingGuests(
  bookingId: string,
  primaryGuestId: string,
  primaryGuestType: "16" | "17" | "18",
  accompagnatori: Array<{
    guest_id?: string // se esistente
    first_name: string
    last_name: string
    gender: string
    date_of_birth: string
    place_of_birth: string
    province_of_birth?: string
    country_of_birth: string
    citizenship: string
    guest_type: "19" | "20"
  }>
): Promise<ActionResult> {
  const supabase = await createClient()

  // Prendi property_id dal booking
  const { data: booking } = await supabase
    .from("bookings")
    .select("property_id")
    .eq("id", bookingId)
    .single()

  if (!booking) return failure("Prenotazione non trovata")

  // Rimuovi vecchi booking_guests per ricrearli
  await supabase
    .from("booking_guests")
    .delete()
    .eq("booking_id", bookingId)

  // Inserisci ospite primario
  const { error: primaryErr } = await supabase
    .from("booking_guests")
    .insert({
      booking_id: bookingId,
      guest_id: primaryGuestId,
      guest_type: primaryGuestType,
      is_primary: true,
    })

  if (primaryErr) return failure(`Errore ospite primario: ${primaryErr.message}`)

  // Processa accompagnatori
  for (const acc of accompagnatori) {
    let guestId = acc.guest_id

    if (!guestId) {
      // Crea nuovo guest
      const accDbDate = itDateToIso(acc.date_of_birth) || acc.date_of_birth
      const { data: newGuest, error: gErr } = await supabase
        .from("guests")
        .insert({
          property_id: booking.property_id,
          full_name: `${acc.first_name} ${acc.last_name}`.trim(),
          first_name: acc.first_name,
          last_name: acc.last_name,
          gender: acc.gender,
          date_of_birth: accDbDate,
          place_of_birth: acc.place_of_birth,
          province_of_birth: acc.province_of_birth || null,
          country_of_birth: acc.country_of_birth,
          citizenship: acc.citizenship,
        })
        .select("id")
        .single()

      if (gErr || !newGuest) return failure(`Errore creazione accompagnatore: ${gErr?.message}`)
      guestId = newGuest.id
    } else {
      // Aggiorna guest esistente con dati Alloggiati
      const accUpdateDate = itDateToIso(acc.date_of_birth) || acc.date_of_birth
      await supabase
        .from("guests")
        .update({
          first_name: acc.first_name,
          last_name: acc.last_name,
          gender: acc.gender,
          date_of_birth: accUpdateDate,
          place_of_birth: acc.place_of_birth,
          province_of_birth: acc.province_of_birth || null,
          country_of_birth: acc.country_of_birth,
          citizenship: acc.citizenship,
        })
        .eq("id", guestId)
    }

    // Inserisci in booking_guests
    const { error: bgErr } = await supabase
      .from("booking_guests")
      .insert({
        booking_id: bookingId,
        guest_id: guestId,
        guest_type: acc.guest_type,
        is_primary: false,
      })

    if (bgErr) return failure(`Errore salvataggio accompagnatore: ${bgErr.message}`)
  }

  revalidatePath(`/bookings/${bookingId}`)
  return success(undefined)
}

// ============================================
// Alloggiati Web SOAP
// ============================================

/**
 * Ottiene le credenziali Alloggiati dalla property.
 */
async function getCredentials(): Promise<ActionResult<AlloggiatiCredentials>> {
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

  const settings = (property.settings || {}) as Record<string, string>

  if (!settings.alloggiati_username || !settings.alloggiati_password || !settings.alloggiati_wskey) {
    return failure("Credenziali Alloggiati Web non configurate. Vai in Impostazioni per configurarle.")
  }

  return success({
    username: settings.alloggiati_username,
    password: settings.alloggiati_password,
    wskey: settings.alloggiati_wskey,
  })
}

/**
 * Costruisce i DatiSchedina da un booking + booking_guests.
 */
async function buildDatiFromBooking(bookingId: string): Promise<ActionResult<DatiSchedina[]>> {
  const supabase = await createClient()

  const { data: booking } = await supabase
    .from("bookings")
    .select("check_in, check_out, nights")
    .eq("id", bookingId)
    .single()

  if (!booking) return failure("Prenotazione non trovata")

  const { data: bGuests } = await supabase
    .from("booking_guests")
    .select(`
      guest_type,
      is_primary,
      guest:guest_id (
        first_name, last_name, gender, date_of_birth,
        place_of_birth, province_of_birth, country_of_birth,
        citizenship, document_type, document_number, document_issued_by
      )
    `)
    .eq("booking_id", bookingId)
    .order("is_primary", { ascending: false })

  if (!bGuests || bGuests.length === 0) {
    return failure("Nessun ospite registrato per questa prenotazione")
  }

  const schedine: DatiSchedina[] = []

  for (const bg of bGuests) {
    const g = bg.guest as unknown as Record<string, string | null>
    if (!g) continue

    const isItaly = g.country_of_birth === CODICE_ITALIA

    const schedina: DatiSchedina = {
      tipoAlloggiato: bg.guest_type as DatiSchedina['tipoAlloggiato'],
      dataArrivo: new Date(booking.check_in),
      giorniPermanenza: Math.min(booking.nights || 1, 30),
      cognome: g.last_name || '',
      nome: g.first_name || '',
      sesso: (g.gender || '1') as '1' | '2',
      dataNascita: g.date_of_birth ? new Date(g.date_of_birth) : new Date(),
      comuneNascita: isItaly ? (g.place_of_birth || undefined) : undefined,
      provinciaNascita: isItaly ? (g.province_of_birth || undefined) : undefined,
      statoNascita: g.country_of_birth || '',
      cittadinanza: g.citizenship || '',
      tipoDocumento: g.document_type || undefined,
      numeroDocumento: g.document_number || undefined,
      luogoRilascioDoc: g.document_issued_by || undefined,
    }

    schedine.push(schedina)
  }

  return success(schedine)
}

/**
 * Testa le schedine (SOAP Test) senza inviarle.
 */
export async function testCheckInSchedine(
  bookingId: string
): Promise<ActionResult<{ schedineValide: number; totale: number; errori: Array<{ riga: number; errore: string }> }>> {
  // Credenziali
  const credsResult = await getCredentials()
  if (credsResult.error || !credsResult.data) return failure(credsResult.error || "Credenziali mancanti")
  const creds = credsResult.data

  // Dati
  const datiResult = await buildDatiFromBooking(bookingId)
  if (datiResult.error || !datiResult.data) return failure(datiResult.error || "Dati mancanti")
  const dati = datiResult.data

  // Validazione locale
  const localValidation = validateElenco(dati)
  if (!localValidation.valid) {
    const errori: Array<{ riga: number; errore: string }> = []
    localValidation.errorsByIndex.forEach((errs, idx) => {
      errs.forEach(e => errori.push({ riga: idx + 1, errore: `${e.campo}: ${e.messaggio}` }))
    })
    return success({ schedineValide: 0, totale: dati.length, errori })
  }

  // Genera righe 168 char
  const righe = buildElencoSchedine(dati)

  // Token
  const tokenResult = await generateToken(creds)
  if (!tokenResult.esito.esito) {
    return failure(`Autenticazione fallita: ${tokenResult.esito.erroreDes}`)
  }

  // Test SOAP
  const testResult = await soapTestSchedine(creds.username, tokenResult.token.token, righe)

  const errori: Array<{ riga: number; errore: string }> = []
  testResult.result.dettaglio.forEach((d, i) => {
    if (!d.esito) {
      errori.push({ riga: i + 1, errore: `${d.erroreDes}: ${d.erroreDettaglio}` })
    }
  })

  return success({
    schedineValide: testResult.result.schedineValide,
    totale: dati.length,
    errori,
  })
}

/**
 * Invia le schedine alla Questura (SOAP Send) e salva il risultato.
 */
export async function sendCheckInSchedine(
  bookingId: string
): Promise<ActionResult<{ schedineValide: number; totale: number; errori: Array<{ riga: number; errore: string }> }>> {
  const supabase = await createClient()

  // Credenziali
  const credsResult = await getCredentials()
  if (credsResult.error || !credsResult.data) return failure(credsResult.error || "Credenziali mancanti")
  const creds = credsResult.data

  // Dati
  const datiResult = await buildDatiFromBooking(bookingId)
  if (datiResult.error || !datiResult.data) return failure(datiResult.error || "Dati mancanti")
  const dati = datiResult.data

  // Validazione locale
  const localValidation = validateElenco(dati)
  if (!localValidation.valid) {
    const errori: Array<{ riga: number; errore: string }> = []
    localValidation.errorsByIndex.forEach((errs, idx) => {
      errs.forEach(e => errori.push({ riga: idx + 1, errore: `${e.campo}: ${e.messaggio}` }))
    })
    return success({ schedineValide: 0, totale: dati.length, errori })
  }

  // Genera righe
  const righe = buildElencoSchedine(dati)

  // Token
  const tokenResult = await generateToken(creds)
  if (!tokenResult.esito.esito) {
    return failure(`Autenticazione fallita: ${tokenResult.esito.erroreDes}`)
  }

  // Send SOAP
  const sendResult = await soapSendSchedine(creds.username, tokenResult.token.token, righe)

  // Salva in alloggiati_submissions
  const { data: booking } = await supabase
    .from("bookings")
    .select("property_id")
    .eq("id", bookingId)
    .single()

  const user = await supabase.auth.getUser()

  const { error: logErr } = await supabase
    .from("alloggiati_submissions")
    .insert({
      property_id: booking?.property_id,
      booking_id: bookingId,
      method: 'Send',
      schedine_count: righe.length,
      schedine_valide: sendResult.result.schedineValide,
      request_data: righe.join('\n'),
      response_esito: sendResult.esito.esito,
      response_error_code: sendResult.esito.erroreCod || null,
      response_error_desc: sendResult.esito.erroreDes || null,
      response_detail: sendResult.result.dettaglio,
      submitted_by: user.data.user?.id || null,
    })
  // Non blocchiamo il flusso se il log fallisce, ma lo tracciamo
  if (logErr) console.error("Errore salvataggio log Alloggiati:", logErr.message)

  const errori: Array<{ riga: number; errore: string }> = []
  sendResult.result.dettaglio.forEach((d, i) => {
    if (!d.esito) {
      errori.push({ riga: i + 1, errore: `${d.erroreDes}: ${d.erroreDettaglio}` })
    }
  })

  revalidatePath(`/bookings/${bookingId}`)

  return success({
    schedineValide: sendResult.result.schedineValide,
    totale: dati.length,
    errori,
  })
}

/**
 * Completa il check-in: invia Alloggiati (opzionale) e cambia stato a CheckedIn.
 */
export async function completeCheckIn(
  bookingId: string,
  options?: { skipAlloggiati?: boolean }
): Promise<ActionResult<{ alloggiatiSent: boolean; alloggiatiErrors?: string[] }>> {
  const supabase = await createClient()
  let alloggiatiSent = false
  const alloggiatiErrors: string[] = []

  // Invia ad Alloggiati se non skip
  if (!options?.skipAlloggiati) {
    const sendResult = await sendCheckInSchedine(bookingId)
    if (sendResult.error) {
      alloggiatiErrors.push(sendResult.error)
    } else if (sendResult.data && sendResult.data.errori.length > 0) {
      sendResult.data.errori.forEach(e => alloggiatiErrors.push(e.errore))
    } else {
      alloggiatiSent = true
    }
  }

  // Cambia stato a CheckedIn
  const { error: updateErr } = await supabase
    .from("bookings")
    .update({
      status: "CheckedIn",
      checked_in_at: new Date().toISOString(),
    })
    .eq("id", bookingId)

  if (updateErr) return failure(`Errore check-in: ${updateErr.message}`)

  // Aggiorna camera a Occupied
  const { data: booking } = await supabase
    .from("bookings")
    .select("room_id")
    .eq("id", bookingId)
    .single()

  if (booking?.room_id) {
    const { error: roomErr } = await supabase
      .from("rooms")
      .update({ status: "Occupied" })
      .eq("id", booking.room_id)
    if (roomErr) console.error("Errore aggiornamento stato camera:", roomErr.message)
  }

  // Calcola e applica tassa di soggiorno (non blocca il check-in)
  try {
    const { calculateAndApplyTouristTax } = await import("@db/queries/tourist-tax")
    await calculateAndApplyTouristTax(bookingId)
  } catch (err) {
    console.error("Tourist tax calculation failed:", err)
  }

  revalidatePath("/bookings")
  revalidatePath("/rooms")
  revalidatePath("/dashboard")
  revalidatePath(`/bookings/${bookingId}`)

  return success({ alloggiatiSent, alloggiatiErrors: alloggiatiErrors.length > 0 ? alloggiatiErrors : undefined })
}

// ============================================
// Test connessione Alloggiati
// ============================================

export async function testAlloggiatiConnection(): Promise<ActionResult<{ message: string }>> {
  const credsResult = await getCredentials()
  if (credsResult.error || !credsResult.data) return failure(credsResult.error || "Credenziali mancanti")
  const creds = credsResult.data

  try {
    const tokenResult = await generateToken(creds)

    if (!tokenResult.esito.esito) {
      return failure(`Autenticazione fallita: ${tokenResult.esito.erroreDes} ${tokenResult.esito.erroreDettaglio}`)
    }

    // Test il token
    const testResult = await authenticationTest(creds.username, tokenResult.token.token)

    if (!testResult.esito) {
      return failure(`Token non valido: ${testResult.erroreDes}`)
    }

    return success({
      message: `Connessione riuscita! Token valido fino a ${tokenResult.token.expires}`,
    })
  } catch (err) {
    return failure(`Errore di connessione: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ============================================
// Salva credenziali Alloggiati
// ============================================

export async function saveAlloggiatiSettings(
  propertyId: string,
  settings: {
    alloggiati_username: string
    alloggiati_password: string
    alloggiati_wskey: string
  }
): Promise<ActionResult> {
  const supabase = await createClient()

  // Leggi settings esistenti
  const { data: property } = await supabase
    .from("properties")
    .select("settings")
    .eq("id", propertyId)
    .single()

  if (!property) return failure("Struttura non trovata")

  const currentSettings = (property.settings || {}) as Record<string, unknown>

  // Merge con settings esistenti
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
// Ricerca ospiti per autocomplete
// ============================================

export async function searchGuests(query: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("guests")
    .select("id, full_name, first_name, last_name, email, date_of_birth, gender, citizenship")
    .ilike("full_name", `%${query}%`)
    .limit(10)

  if (error) return failure(error.message)
  return success(data || [])
}

// ============================================
// Dashboard Check-in
// ============================================

/**
 * KPI per la pagina check-in dedicata.
 */
export async function getCheckInDashboard() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10)

  // Arrivi oggi da fare (Confirmed con check_in = oggi)
  const { count: daFare } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("check_in", today)
    .eq("status", "Confirmed")

  // Check-in completati oggi
  const { count: completati } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("check_in", today)
    .eq("status", "CheckedIn")

  // Totale in casa
  const { count: inCasa } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", "CheckedIn")

  // Alloggiati pendenti: CheckedIn senza submission con response_esito=true
  const { data: checkedInBookings } = await supabase
    .from("bookings")
    .select("id")
    .eq("status", "CheckedIn")

  let alloggiatiPendenti = 0
  if (checkedInBookings && checkedInBookings.length > 0) {
    const bookingIds = checkedInBookings.map((b) => b.id)
    const { data: submissions } = await supabase
      .from("alloggiati_submissions")
      .select("booking_id")
      .in("booking_id", bookingIds)
      .eq("method", "Send")
      .eq("response_esito", true)

    const sentBookingIds = new Set(submissions?.map((s) => s.booking_id) || [])
    alloggiatiPendenti = bookingIds.filter((id) => !sentBookingIds.has(id)).length
  }

  return success({
    daFare: daFare || 0,
    completati: completati || 0,
    inCasa: inCasa || 0,
    alloggiatiPendenti,
  })
}

/**
 * Lista prenotazioni per la pagina check-in.
 */
export async function getCheckInList(filters?: {
  date?: string      // YYYY-MM-DD, default oggi
  status?: "da_fare" | "completato" | "tutti"
  search?: string
}) {
  const supabase = await createClient()
  const date = filters?.date || new Date().toISOString().slice(0, 10)
  const statusFilter = filters?.status || "tutti"

  let query = supabase
    .from("bookings")
    .select(`
      *,
      guest:guest_id (id, full_name, first_name, last_name, citizenship),
      room:room_id (id, name),
      room_type:room_type_id (id, name, short_code)
    `)
    .eq("check_in", date)
    .order("created_at", { ascending: false })
    .limit(100)

  // Filtro stato
  if (statusFilter === "da_fare") {
    query = query.eq("status", "Confirmed")
  } else if (statusFilter === "completato") {
    query = query.eq("status", "CheckedIn")
  } else {
    query = query.in("status", ["Confirmed", "CheckedIn"])
  }

  // Ricerca
  if (filters?.search) {
    query = query.ilike("guest.full_name", `%${filters.search}%`)
  }

  const { data, error } = await query

  if (error) return failure(error.message)

  // Arricchisci con dati Alloggiati submission
  const bookingIds = (data || []).map((b) => b.id)
  let submissionsMap = new Map<string, { esito: boolean; method: string }>()

  if (bookingIds.length > 0) {
    const { data: subs } = await supabase
      .from("alloggiati_submissions")
      .select("booking_id, response_esito, method")
      .in("booking_id", bookingIds)
      .eq("method", "Send")
      .order("submitted_at", { ascending: false })

    if (subs) {
      for (const s of subs) {
        if (!submissionsMap.has(s.booking_id)) {
          submissionsMap.set(s.booking_id, {
            esito: s.response_esito ?? false,
            method: s.method,
          })
        }
      }
    }
  }

  const enriched = (data || []).map((b) => ({
    ...b,
    alloggiati: submissionsMap.get(b.id) || null,
  }))

  return success(enriched)
}
