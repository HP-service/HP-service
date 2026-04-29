// ============================================
// Alloggiati Web - Schedine Builder
// Costruisce stringhe a lunghezza fissa (168 char)
// dal tracciato record TABELLA 1 del manuale.
// ============================================

import {
  type DatiSchedina,
  SCHEDINA_LENGTH,
  TIPI_CON_DOCUMENTO,
  TRACCIATO,
} from './types';

// ── Utility per padding ────────────────────────

/** Pad a destra con spazi fino a lunghezza desiderata, tronca se eccede */
function padRight(str: string, len: number): string {
  return str.substring(0, len).padEnd(len, ' ');
}

/** Pad a sinistra con "0" fino a lunghezza desiderata */
function padLeft(str: string, len: number): string {
  return str.substring(0, len).padStart(len, '0');
}

/** Formatta data come gg/mm/aaaa */
function formatDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

/** Normalizza stringa: uppercase, rimuove accenti, trim */
function normalize(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

// ── Builder principale ─────────────────────────

/**
 * Costruisce una singola schedina come stringa a 168 caratteri.
 * Segue il tracciato TABELLA 1 del manuale WS_ALLOGGIATI.
 */
export function buildSchedina(dati: DatiSchedina): string {
  const richiedeDocumento = TIPI_CON_DOCUMENTO.includes(dati.tipoAlloggiato);

  // Costruisco ogni campo nella posizione corretta
  const campi: string[] = [];

  // [0-1] Tipo Alloggiato (2 char, pad "0" a sx)
  campi.push(padLeft(dati.tipoAlloggiato, TRACCIATO.TIPO_ALLOGGIATO.len));

  // [2-11] Data Arrivo (gg/mm/aaaa, 10 char)
  campi.push(formatDate(dati.dataArrivo));

  // [12-13] Giorni Permanenza (2 char, pad "0" a sx)
  campi.push(padLeft(String(Math.min(dati.giorniPermanenza, 30)), TRACCIATO.GIORNI_PERMANENZA.len));

  // [14-63] Cognome (50 char, pad spazi a dx)
  campi.push(padRight(normalize(dati.cognome), TRACCIATO.COGNOME.len));

  // [64-93] Nome (30 char, pad spazi a dx)
  campi.push(padRight(normalize(dati.nome), TRACCIATO.NOME.len));

  // [94] Sesso (1 char: "1"=M, "2"=F)
  campi.push(dati.sesso);

  // [95-104] Data Nascita (gg/mm/aaaa)
  campi.push(formatDate(dati.dataNascita));

  // [105-113] Comune Nascita (9 char, blank se estero)
  campi.push(padRight(dati.comuneNascita || '', TRACCIATO.COMUNE_NASCITA.len));

  // [114-115] Provincia Nascita (2 char, blank se estero)
  campi.push(padRight(dati.provinciaNascita || '', TRACCIATO.PROVINCIA_NASCITA.len));

  // [116-124] Stato Nascita (9 char)
  campi.push(padRight(dati.statoNascita, TRACCIATO.STATO_NASCITA.len));

  // [125-133] Cittadinanza (9 char)
  campi.push(padRight(dati.cittadinanza, TRACCIATO.CITTADINANZA.len));

  // [134-138] Tipo Documento (5 char, blank per tipo 19/20)
  campi.push(
    richiedeDocumento
      ? padRight(dati.tipoDocumento || '', TRACCIATO.TIPO_DOCUMENTO.len)
      : padRight('', TRACCIATO.TIPO_DOCUMENTO.len)
  );

  // [139-158] Numero Documento (20 char, blank per tipo 19/20)
  campi.push(
    richiedeDocumento
      ? padRight(normalize(dati.numeroDocumento || ''), TRACCIATO.NUMERO_DOCUMENTO.len)
      : padRight('', TRACCIATO.NUMERO_DOCUMENTO.len)
  );

  // [159-167] Luogo Rilascio Documento (9 char, blank per tipo 19/20)
  campi.push(
    richiedeDocumento
      ? padRight(dati.luogoRilascioDoc || '', TRACCIATO.LUOGO_RILASCIO.len)
      : padRight('', TRACCIATO.LUOGO_RILASCIO.len)
  );

  const riga = campi.join('');

  // Sanity check
  if (riga.length !== SCHEDINA_LENGTH) {
    throw new Error(
      `Schedina non valida: lunghezza ${riga.length}, attesa ${SCHEDINA_LENGTH}. ` +
      `Ospite: ${dati.cognome} ${dati.nome}`
    );
  }

  return riga;
}

/**
 * Costruisce un array di stringhe schedina da un array di dati.
 * Ogni stringa è lunga esattamente 168 caratteri.
 */
export function buildElencoSchedine(schedine: DatiSchedina[]): string[] {
  return schedine.map(buildSchedina);
}
