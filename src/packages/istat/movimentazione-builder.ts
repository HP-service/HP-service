// ============================================
// ISTAT Movimentazione - Builder
// Calcola giornate ISTAT dai dati prenotazioni.
// ============================================

import type { Giornata, Movimentazione } from './types'
import { formatDateIstat } from './api-client'

// ── Types per input ──────────────────────────

export interface BookingForIstat {
  id: string
  check_in: string    // YYYY-MM-DD
  check_out: string   // YYYY-MM-DD
  room_id: string | null
  status: string
  guests: Array<{
    citizenship: string | null     // codice Alloggiati 9 cifre (es. "100000100")
    province_of_birth: string | null // sigla provincia (es. "NA")
  }>
}

// ── Mappa codici Alloggiati → ISTAT ──────────

/**
 * Mappa codice stato Alloggiati (9 cifre) al codice nazione ISTAT (3 cifre).
 * Il codice Alloggiati è nel formato "1XXYYY00Z" dove XXX è il codice area.
 * Per l'ISTAT usiamo la tabella codici fornita dall'API /v1/codici-istat.
 *
 * Come fallback, prendiamo le cifre centrali del codice Alloggiati.
 * In produzione si deve fare lookup sulla tabella scaricata da getCodiciIstat().
 */
export function alloggiatiToIstatNazione(codiceAlloggiati: string): string {
  // Il codice Italia Alloggiati è "100000100"
  // Il codice Italia ISTAT nazione è "100" (o "206" per EPT, dipende dalla regione)
  // Per ora restituiamo le prime 3 cifre significative del codice
  if (!codiceAlloggiati || codiceAlloggiati.length < 9) return '100'
  // Prende i caratteri 1-3 (dopo il primo "1")
  return codiceAlloggiati.substring(0, 3)
}

/**
 * Per ospiti italiani, mappa la provincia di nascita al codice ISTAT provincia.
 * La sigla provincia (es. "NA") deve essere mappata al codice ISTAT (es. "063").
 * Questa mappa sarà popolata dai codici scaricati da getCodiciIstat().
 */
const PROVINCE_MAP: Record<string, string> = {
  // Le più comuni - la mappa completa viene dai codici ISTAT
  AG: '084', AL: '006', AN: '042', AO: '007', AP: '044', AQ: '066',
  AR: '051', AT: '005', AV: '064', BA: '072', BG: '016', BI: '096',
  BL: '025', BN: '062', BO: '037', BR: '074', BS: '017', BT: '110',
  BZ: '021', CA: '092', CB: '070', CE: '061', CH: '069', CI: '107',
  CL: '085', CN: '004', CO: '013', CR: '019', CS: '078', CT: '087',
  CZ: '079', EN: '086', FC: '040', FE: '038', FG: '071', FI: '048',
  FM: '109', FR: '060', GE: '010', GO: '031', GR: '053', IM: '008',
  IS: '094', KR: '101', LC: '097', LE: '075', LI: '049', LO: '098',
  LT: '059', LU: '046', MB: '108', MC: '043', ME: '083', MI: '015',
  MN: '020', MO: '036', MS: '045', MT: '077', NA: '063', NO: '003',
  NU: '091', OG: '105', OR: '095', OT: '104', PA: '082', PC: '033',
  PD: '028', PE: '068', PG: '054', PI: '050', PL: '108', PN: '093',
  PO: '100', PR: '034', PT: '047', PU: '041', PV: '018', PZ: '076',
  RA: '039', RC: '080', RE: '035', RG: '088', RI: '057', RM: '058',
  RN: '099', RO: '029', SA: '065', SI: '052', SO: '014', SP: '011',
  SR: '089', SS: '090', SU: '111', SV: '009', TA: '073', TE: '067',
  TN: '022', TO: '001', TP: '081', TR: '055', TS: '032', TV: '026',
  UD: '030', VA: '012', VB: '103', VC: '002', VE: '027', VI: '024',
  VR: '023', VS: '106', VT: '056', VV: '102',
}

export function provinceSiglaToIstat(sigla: string): string | undefined {
  return PROVINCE_MAP[sigla.toUpperCase()]
}

// ── Builder principale ───────────────────────

/**
 * Costruisce le giornate ISTAT da un range di date e prenotazioni.
 *
 * Per ogni giorno nel range:
 * - Arrivi: ospiti con check_in = quel giorno (status CheckedIn)
 * - Partenze: ospiti con check_out = quel giorno
 * - Presenti notte precedente: ospiti il cui soggiorno copre quella notte
 * - Camere occupate: conteggio room_id distinti
 *
 * Raggruppa per nazionalità (stranieri → codiceNazione) o provincia (italiani → codiceProvincia).
 */
export function buildGiornate(
  dateFrom: Date,
  dateTo: Date,
  bookings: BookingForIstat[],
  codiceItalia = '100000100'
): Giornata[] {
  const giornate: Giornata[] = []

  const current = new Date(dateFrom)
  while (current <= dateTo) {
    const dateStr = current.toISOString().slice(0, 10)
    const dataRilevazione = formatDateIstat(current)

    // Arrivi: check_in = today, status in (CheckedIn, CheckedOut - cioè effettivamente arrivati)
    const arrivals = bookings.filter(
      (b) => b.check_in === dateStr && ['CheckedIn', 'CheckedOut'].includes(b.status)
    )

    // Partenze: check_out = today
    const departures = bookings.filter(
      (b) => b.check_out === dateStr && ['CheckedIn', 'CheckedOut'].includes(b.status)
    )

    // Presenti notte precedente: check_in < today AND check_out > today (era già in casa la notte prima)
    // Oppure: check_in < today AND check_out >= today
    const stayovers = bookings.filter((b) => {
      return b.check_in < dateStr && b.check_out >= dateStr &&
        ['CheckedIn', 'CheckedOut'].includes(b.status)
    })

    // Camere occupate: booking con check_in <= today < check_out
    const occupiedRooms = new Set<string>()
    bookings.forEach((b) => {
      if (
        b.room_id &&
        b.check_in <= dateStr &&
        b.check_out > dateStr &&
        ['CheckedIn', 'CheckedOut'].includes(b.status)
      ) {
        occupiedRooms.add(b.room_id)
      }
    })

    // Raggruppa per codice (nazione per stranieri, provincia per italiani)
    const groups = new Map<string, { type: 'nazione' | 'provincia'; arrivi: number; presenti: number; partenze: number }>()

    function addToGroup(guests: BookingForIstat['guests'], field: 'arrivi' | 'presenti' | 'partenze', count = 1) {
      for (const g of guests) {
        const isItaliano = g.citizenship === codiceItalia
        let key: string
        let type: 'nazione' | 'provincia'

        if (isItaliano && g.province_of_birth) {
          const provCode = provinceSiglaToIstat(g.province_of_birth)
          if (provCode) {
            key = `P:${provCode}`
            type = 'provincia'
          } else {
            key = `N:${alloggiatiToIstatNazione(g.citizenship || '')}`
            type = 'nazione'
          }
        } else {
          key = `N:${alloggiatiToIstatNazione(g.citizenship || '')}`
          type = 'nazione'
        }

        const existing = groups.get(key) || { type, arrivi: 0, presenti: 0, partenze: 0 }
        existing[field] += count
        groups.set(key, existing)
      }
    }

    // Se non ci sono ospiti registrati nel booking, contiamo il booking stesso come 1 ospite
    for (const b of arrivals) {
      if (b.guests.length > 0) {
        addToGroup(b.guests, 'arrivi')
      }
    }
    for (const b of stayovers) {
      if (b.guests.length > 0) {
        addToGroup(b.guests, 'presenti')
      }
    }
    for (const b of departures) {
      if (b.guests.length > 0) {
        addToGroup(b.guests, 'partenze')
      }
    }

    // Costruisci movimentazioni
    const movimentazioni: Movimentazione[] = []
    for (const [key, data] of groups.entries()) {
      const [typePrefix, code] = key.split(':')
      if (typePrefix === 'P') {
        movimentazioni.push({
          codiceProvincia: code,
          arrivi: data.arrivi,
          presentiNottePrecedente: data.presenti,
          partenze: data.partenze,
        })
      } else {
        movimentazioni.push({
          codiceNazione: code,
          arrivi: data.arrivi,
          presentiNottePrecedente: data.presenti,
          partenze: data.partenze,
        })
      }
    }

    giornate.push({
      dataRilevazione,
      camereOccupate: occupiedRooms.size,
      strutturaChiusa: false,
      movimentazioni,
    })

    current.setDate(current.getDate() + 1)
  }

  return giornate
}
