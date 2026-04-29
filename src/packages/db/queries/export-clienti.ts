"use server"

import { createClient } from "@/lib/supabase/server"
import { success, failure, type ActionResult } from "@utils/errors"

// ─── Tipi ──────────────────────────────────────────────────────────────────────

/**
 * Riga nel formato richiesto dai gestionali fatture italiani
 * (Fatture in Cloud, TeamSystem, ecc.) per import anagrafiche.
 * Conforme a SDI / Codice Paese ISO 3166-1 alpha-2.
 */
export type ClienteFatturaRow = {
  "Codice cliente": string
  "Tipo cliente": "Privato" | "Pubblica amministrazione" | "Azienda"
  "Indirizzo telematico (Codice SDI o PEC)": string
  "Email": string
  "PEC": string
  "Telefono": string
  "ID Paese": string
  "Partita Iva": string
  "Codice fiscale": string
  "Denominazione": string
  "Nome": string
  "Cognome": string
  "Codice EORI (solo Privati)": string
  "Nazione": string
  "CAP": string
  "Provincia": string
  "Comune": string
  "Indirizzo": string
  "Numero civico": string
  "Beneficiario": string
  "Condizioni di pagamento": string
  "Metodo di pagamento": string
  "Banca": string
}

export type ExportClientiFilters = {
  /** Filtra solo ospiti con almeno una prenotazione check-in tra queste date */
  dateFrom?: string
  dateTo?: string
  /** Solo ospiti con almeno N soggiorni completati */
  minStays?: number
  /** Solo ospiti con dato fiscale presente (ID/CF) */
  onlyWithFiscalData?: boolean
  /** Default per condizioni e metodo di pagamento */
  defaultPagamento?: string
  defaultMetodo?: string
  defaultBanca?: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Mappa una nazionalità o paese testuale al codice ISO 3166-1 alpha-2.
 * Default IT se non riconosciuto. Coverage parziale ma copre i casi principali B&B.
 */
const COUNTRY_MAP: Record<string, string> = {
  // Italiano
  italia: "IT", italy: "IT", it: "IT",
  // Europa
  francia: "FR", france: "FR", fr: "FR",
  germania: "DE", germany: "DE", de: "DE", deutschland: "DE",
  spagna: "ES", spain: "ES", es: "ES",
  "regno unito": "GB", uk: "GB", "united kingdom": "GB", inghilterra: "GB", gb: "GB",
  irlanda: "IE", ireland: "IE", ie: "IE",
  paesibassi: "NL", "paesi bassi": "NL", olanda: "NL", netherlands: "NL", nl: "NL",
  belgio: "BE", belgium: "BE", be: "BE",
  austria: "AT", at: "AT",
  svizzera: "CH", switzerland: "CH", ch: "CH",
  portogallo: "PT", portugal: "PT", pt: "PT",
  grecia: "GR", greece: "GR", gr: "GR",
  polonia: "PL", poland: "PL", pl: "PL",
  norvegia: "NO", norway: "NO", no: "NO",
  svezia: "SE", sweden: "SE", se: "SE",
  danimarca: "DK", denmark: "DK", dk: "DK",
  finlandia: "FI", finland: "FI", fi: "FI",
  // Americas
  "stati uniti": "US", usa: "US", us: "US", "united states": "US", america: "US",
  canada: "CA", ca: "CA",
  brasile: "BR", brazil: "BR", br: "BR",
  argentina: "AR", ar: "AR",
  cile: "CL", chile: "CL", cl: "CL",
  messico: "MX", mexico: "MX", mx: "MX",
  // Asia / Oceania
  cina: "CN", china: "CN", cn: "CN",
  giappone: "JP", japan: "JP", jp: "JP",
  india: "IN", in: "IN",
  australia: "AU", au: "AU",
  "nuova zelanda": "NZ", nz: "NZ", "new zealand": "NZ",
  corea: "KR", "south korea": "KR", kr: "KR",
  // Medio Oriente / Africa
  israele: "IL", israel: "IL", il: "IL",
  egitto: "EG", egypt: "EG", eg: "EG",
  marocco: "MA", morocco: "MA", ma: "MA",
}

function normalizeCountry(input: string | null | undefined): string {
  if (!input) return "IT"
  const trimmed = input.trim()
  // Già codice ISO2 (2 lettere maiuscole)
  if (/^[A-Z]{2}$/.test(trimmed)) return trimmed
  if (/^[a-z]{2}$/.test(trimmed)) return trimmed.toUpperCase()
  // Lookup da nome
  const key = trimmed.toLowerCase().replace(/\s+/g, " ").trim()
  return COUNTRY_MAP[key] ?? "IT"
}

/**
 * Province italiane valide (sigla 2 lettere). Fuori IT → "EE".
 */
const PROVINCE_IT = new Set([
  "AG","AL","AN","AO","AP","AQ","AR","AT","AV","BA","BG","BI","BL","BN","BO","BR","BS","BT","BZ",
  "CA","CB","CE","CH","CI","CL","CN","CO","CR","CS","CT","CZ","EN","FC","FE","FG","FI","FM","FR",
  "GE","GO","GR","IM","IS","KR","LC","LE","LI","LO","LT","LU","MB","MC","ME","MI","MN","MO","MS","MT",
  "NA","NO","NU","OG","OR","OT","PA","PC","PD","PE","PG","PI","PN","PO","PR","PT","PU","PV","PZ",
  "RA","RC","RE","RG","RI","RM","RN","RO","SA","SI","SO","SP","SR","SS","SU","SV","TA","TE","TN",
  "TO","TP","TR","TS","TV","UD","VA","VB","VC","VE","VI","VR","VS","VT","VV"
])

/**
 * Per uso futuro: quando avremo il campo `provincia` nei guests,
 * questa funzione validerà la sigla italiana o restituirà "EE" per gli esteri.
 */
export function normalizeProvincia(input: string | null | undefined, countryCode: string): string {
  if (countryCode !== "IT") return "EE" // codice estero
  if (!input) return ""
  const code = input.trim().toUpperCase()
  if (PROVINCE_IT.has(code)) return code
  return ""
}

/**
 * Estrae nome e cognome da `full_name`.
 * Se ci sono 2+ parole: prima parola = nome, resto = cognome.
 */
function splitName(fullName: string): { nome: string; cognome: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return { nome: "", cognome: "" }
  if (parts.length === 1) return { nome: parts[0], cognome: "" }
  return { nome: parts[0], cognome: parts.slice(1).join(" ") }
}

/**
 * Splitta indirizzo in via + numero civico (best effort, regex).
 */
function splitAddress(address: string | null): { via: string; civico: string } {
  if (!address) return { via: "", civico: "" }
  const m = address.trim().match(/^(.*?)[\s,]+(\d+[a-zA-Z/]*)\s*$/)
  if (m) return { via: m[1].trim(), civico: m[2].trim() }
  return { via: address.trim(), civico: "" }
}

// ─── Query principale ──────────────────────────────────────────────────────────

export async function getClientiForExport(
  filters?: ExportClientiFilters
): Promise<ActionResult<ClienteFatturaRow[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return failure("Non autenticato")

  const { data: profile } = await supabase
    .from("profiles")
    .select("property_id")
    .eq("id", user.id)
    .single()
  if (!profile?.property_id) return failure("Property non trovata")

  // Query base: tutti i guest della property
  let query = supabase
    .from("guests")
    .select(`
      id, full_name, email, phone, nationality, country,
      tax_code, document_type, document_number,
      address, city, total_stays
    `)
    .eq("property_id", profile.property_id)
    .order("full_name")

  if (filters?.minStays && filters.minStays > 0) {
    query = query.gte("total_stays", filters.minStays)
  }
  if (filters?.onlyWithFiscalData) {
    query = query.not("tax_code", "is", null)
  }

  const { data: guests, error } = await query
  if (error) return failure(error.message)

  // Se filtro per date check-in, prendi solo ospiti che hanno una booking nel range
  let allowedGuestIds: Set<string> | null = null
  if (filters?.dateFrom || filters?.dateTo) {
    let bq = supabase
      .from("bookings")
      .select("guest_id")
      .eq("property_id", profile.property_id)
      .in("status", ["CheckedIn", "CheckedOut"])

    if (filters.dateFrom) bq = bq.gte("check_in", filters.dateFrom)
    if (filters.dateTo) bq = bq.lte("check_in", filters.dateTo)

    const { data: bookings } = await bq
    allowedGuestIds = new Set((bookings ?? []).map((b) => b.guest_id))
  }

  const filtered = allowedGuestIds
    ? (guests ?? []).filter((g) => allowedGuestIds!.has(g.id))
    : (guests ?? [])

  // Trasformazione SDI — conforme alle regole Agenzia Entrate 2026
  // ─────────────────────────────────────────────────────────────────
  // CLIENTI ITALIANI (privati senza SDI/PEC):
  //   - Codice Destinatario: "0000000" (7 zeri)
  //   - Codice Fiscale: obbligatorio
  //   - CAP: reale | Provincia: sigla 2 lettere
  //
  // CLIENTI ESTERI (UE / Extra-UE, privati o aziende):
  //   - Codice Destinatario: "XXXXXXX" (7 X)
  //   - Codice Fiscale: NON obbligatorio (vuoto)
  //   - Partita IVA: opzionale (max 28 char alfanumerici)
  //   - CAP: "00000" (convenzionale)
  //   - Provincia: "EE" (estero)
  //   - Va consegnata copia analogica/PDF al cliente
  // ─────────────────────────────────────────────────────────────────
  const rows: ClienteFatturaRow[] = filtered.map((g) => {
    const { nome, cognome } = splitName(g.full_name)
    const countryCode = normalizeCountry(g.country ?? g.nationality)
    const isItaliano = countryCode === "IT"
    const { via, civico } = splitAddress(g.address)

    // Codice Destinatario SDI: "0000000" privati italiani, "XXXXXXX" esteri
    const codiceSDI = isItaliano ? "0000000" : "XXXXXXX"

    // CAP: vuoto privato italiano (default DB), "00000" estero
    const cap = isItaliano ? "" : "00000"

    // Provincia: vuoto privato italiano (manca dato in DB), "EE" estero
    const provincia = isItaliano ? "" : "EE"

    // Comune / Indirizzo per esteri: meglio passare il nome città estero se
    // disponibile, altrimenti fallback sul nome del paese.
    const comuneEstero = (g.city && g.city.trim()) || (g.country ?? "").toUpperCase()
    const indirizzoEstero = (g.address && g.address.trim()) || (g.country ?? "").toUpperCase()

    return {
      "Codice cliente": g.full_name.toUpperCase(),
      "Tipo cliente": "Privato",
      "Indirizzo telematico (Codice SDI o PEC)": codiceSDI,
      "Email": g.email ?? "",
      "PEC": "",
      "Telefono": g.phone ?? "",
      "ID Paese": countryCode,
      "Partita Iva": "",
      // CF: solo per italiani con dato (privati esteri esenti per legge)
      "Codice fiscale": isItaliano ? (g.tax_code ?? "") : "",
      "Denominazione": g.full_name,
      "Nome": nome,
      "Cognome": cognome,
      "Codice EORI (solo Privati)": "",
      "Nazione": isItaliano ? "ITALIA" : (g.country ?? "").toUpperCase(),
      "CAP": cap,
      "Provincia": provincia,
      "Comune": isItaliano ? (g.city ?? "") : comuneEstero,
      "Indirizzo": isItaliano ? via : indirizzoEstero,
      "Numero civico": civico,
      "Beneficiario": "",
      "Condizioni di pagamento": filters?.defaultPagamento ?? "Pagamento completo",
      "Metodo di pagamento": filters?.defaultMetodo ?? "Carta di credito",
      "Banca": filters?.defaultBanca ?? "",
    }
  })

  return success(rows)
}
