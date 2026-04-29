// ============================================
// ISTAT Movimentazione - Tipi TypeScript
// Basato su OpenAPI api-gestionali v1.3.0
// Regione Campania
// ============================================

/** Credenziali per l'autenticazione ISTAT */
export interface IstatCredentials {
  cusr: string       // Identificativo regionale struttura (es. "15123123ALBXXXX")
  apiKey: string     // API Key associata alla struttura
  useSandbox: boolean // true = ambiente test, false = produzione
}

/** Token JWT restituito dal login */
export interface IstatToken {
  accessToken: string
  expiresIn: number   // validità in secondi
}

/** Singola movimentazione (per nazionalità o provincia) */
export interface Movimentazione {
  codiceNazione?: string      // Codice EPT nazione (es. "206" = Italia)
  codiceProvincia?: string    // Codice ISTAT provincia (es. "063" = Napoli)
  arrivi: number
  presentiNottePrecedente: number
  partenze: number
}

/** Dati di una giornata */
export interface Giornata {
  dataRilevazione: string    // formato DDMMYYYY (es. "01052025")
  camereOccupate: number
  strutturaChiusa: boolean
  movimentazioni: Movimentazione[]
}

/** Request body per POST/PUT movimentazione */
export interface MovimentazioneRequest {
  giornate: Giornata[]
}

/** Response body per GET movimentazione */
export interface MovimentazioneResponse {
  giornate: Giornata[]
}

/** Codici ISTAT (province e nazioni) */
export interface CodiceIstat {
  descrizione: string
  codiceIstat: string
}

export interface CodiciIstatResponse {
  province: CodiceIstat[]
  nazioni: CodiceIstat[]
}

/** Data ultima rilevazione */
export interface UltimaRilevazioneResponse {
  dataUltimaRilevazione: string | null  // DDMMYYYY o null
}

/** Anagrafica struttura */
export interface AnagraficaResponse {
  denominazione: string
  codiceFiscale: string
  partitaIva: string
  cin: string
  cusr: string
  indirizzo: string
  civico: string
  cap: string
  comune: string
  provincia: string
  macroCategoria: string
  categoria: string
  sottoCategoria: string
  numeroCamere: number
  numeroPostiLetto: number
  email: string
  sitoWeb: string
}

/** Errore API */
export interface IstatErrorResponse {
  errore: string
}

// ── Costanti ─────────────────────────────────

export const ENDPOINT_TEST = "https://turismo-coll.regione.campania.it/turismoweb/api-gestionali"
export const ENDPOINT_PROD = "https://turismo.regione.campania.it/turismoweb/api-gestionali"
