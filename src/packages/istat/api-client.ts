// ============================================
// ISTAT Movimentazione - REST API Client
// Basato su OpenAPI api-gestionali v1.3.0
// ============================================

import type {
  IstatCredentials,
  IstatToken,
  Giornata,
  MovimentazioneResponse,
  CodiciIstatResponse,
  UltimaRilevazioneResponse,
  AnagraficaResponse,
  IstatErrorResponse,
} from './types'
import { ENDPOINT_TEST, ENDPOINT_PROD } from './types'

// ── Helpers ──────────────────────────────────

function getBaseUrl(useSandbox: boolean): string {
  return useSandbox ? ENDPOINT_TEST : ENDPOINT_PROD
}

/** Formatta Date → DDMMYYYY */
export function formatDateIstat(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yyyy = String(date.getFullYear())
  return `${dd}${mm}${yyyy}`
}

/** Parse DDMMYYYY → Date */
export function parseDateIstat(ddmmyyyy: string): Date {
  const dd = parseInt(ddmmyyyy.slice(0, 2))
  const mm = parseInt(ddmmyyyy.slice(2, 4)) - 1
  const yyyy = parseInt(ddmmyyyy.slice(4, 8))
  return new Date(yyyy, mm, dd)
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as IstatErrorResponse
      if (body.errore) errMsg = body.errore
    } catch {
      // ignore parse error
    }
    throw new Error(errMsg)
  }
  return res.json() as Promise<T>
}

// ── Auth ─────────────────────────────────────

/**
 * Login: ottiene token JWT.
 */
export async function login(creds: IstatCredentials): Promise<IstatToken> {
  const baseUrl = getBaseUrl(creds.useSandbox)
  const res = await fetch(`${baseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cusr: creds.cusr, apiKey: creds.apiKey }),
  })
  return handleResponse<IstatToken>(res)
}

// ── Codici ISTAT ─────────────────────────────

/**
 * Restituisce la lista dei codici ISTAT ammessi (province + nazioni).
 */
export async function getCodiciIstat(
  token: string,
  useSandbox: boolean
): Promise<CodiciIstatResponse> {
  const baseUrl = getBaseUrl(useSandbox)
  const res = await fetch(`${baseUrl}/v1/codici-istat`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse<CodiciIstatResponse>(res)
}

// ── Anagrafica ───────────────────────────────

/**
 * Restituisce l'anagrafica della struttura ricettiva.
 */
export async function getAnagrafica(
  token: string,
  useSandbox: boolean
): Promise<AnagraficaResponse> {
  const baseUrl = getBaseUrl(useSandbox)
  const res = await fetch(`${baseUrl}/v1/anagrafica`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse<AnagraficaResponse>(res)
}

// ── Ultima rilevazione ───────────────────────

/**
 * Data dell'ultima rilevazione inserita.
 */
export async function getUltimaRilevazione(
  token: string,
  useSandbox: boolean
): Promise<UltimaRilevazioneResponse> {
  const baseUrl = getBaseUrl(useSandbox)
  const res = await fetch(`${baseUrl}/v1/movimentazione/ultima-rilevazione`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse<UltimaRilevazioneResponse>(res)
}

// ── Movimentazione CRUD ──────────────────────

/**
 * Invia movimentazione (POST).
 */
export async function postMovimentazione(
  token: string,
  useSandbox: boolean,
  giornate: Giornata[]
): Promise<void> {
  const baseUrl = getBaseUrl(useSandbox)
  const res = await fetch(`${baseUrl}/v1/movimentazione`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ giornate }),
  })
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as IstatErrorResponse
      if (body.errore) errMsg = body.errore
    } catch { /* ignore */ }
    throw new Error(errMsg)
  }
}

/**
 * Modifica movimentazione (PUT).
 */
export async function putMovimentazione(
  token: string,
  useSandbox: boolean,
  giornate: Giornata[]
): Promise<void> {
  const baseUrl = getBaseUrl(useSandbox)
  const res = await fetch(`${baseUrl}/v1/movimentazione`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ giornate }),
  })
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as IstatErrorResponse
      if (body.errore) errMsg = body.errore
    } catch { /* ignore */ }
    throw new Error(errMsg)
  }
}

/**
 * Recupera movimentazione (GET).
 */
export async function getMovimentazione(
  token: string,
  useSandbox: boolean,
  dataInizio: string, // DDMMYYYY
  offset?: number
): Promise<MovimentazioneResponse> {
  const baseUrl = getBaseUrl(useSandbox)
  const params = new URLSearchParams({ dataInizio })
  if (offset) params.set('offset', String(offset))
  const res = await fetch(`${baseUrl}/v1/movimentazione?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return handleResponse<MovimentazioneResponse>(res)
}

/**
 * Elimina movimentazione (DELETE).
 */
export async function deleteMovimentazione(
  token: string,
  useSandbox: boolean,
  dataInizio: string, // DDMMYYYY
  offset?: number
): Promise<void> {
  const baseUrl = getBaseUrl(useSandbox)
  const params = new URLSearchParams({ dataInizio })
  if (offset) params.set('offset', String(offset))
  const res = await fetch(`${baseUrl}/v1/movimentazione?${params}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok && res.status !== 204) {
    let errMsg = `HTTP ${res.status}`
    try {
      const body = (await res.json()) as IstatErrorResponse
      if (body.errore) errMsg = body.errore
    } catch { /* ignore */ }
    throw new Error(errMsg)
  }
}
