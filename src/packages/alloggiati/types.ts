// ============================================
// Alloggiati Web - Tipi TypeScript
// Basato su MANUALEWS.pdf Rev. 01 (24/01/2022)
// ============================================

/** Codici tipo alloggiato dal CSV ufficiale */
export const TIPO_ALLOGGIATO = {
  OSPITE_SINGOLO: '16',
  CAPO_FAMIGLIA: '17',
  CAPO_GRUPPO: '18',
  FAMILIARE: '19',
  MEMBRO_GRUPPO: '20',
} as const;

export type TipoAlloggiato = (typeof TIPO_ALLOGGIATO)[keyof typeof TIPO_ALLOGGIATO];

/** Tipi che richiedono documento (16, 17, 18) */
export const TIPI_CON_DOCUMENTO: TipoAlloggiato[] = ['16', '17', '18'];

/** Sesso come da tracciato: 1=M, 2=F */
export const SESSO = { M: '1', F: '2' } as const;
export type Sesso = (typeof SESSO)[keyof typeof SESSO];

/** Codice ITALIA nella tabella stati */
export const CODICE_ITALIA = '100000100';

/** Lunghezza totale schedina hotel (Tabella 1 manuale) */
export const SCHEDINA_LENGTH = 168;

// ── Credenziali ───────────────────────────────────────

export interface AlloggiatiCredentials {
  username: string;
  password: string;
  wskey: string;
}

// ── Risposte SOAP ────────────────────────────────────

export interface EsitoOperazione {
  esito: boolean;
  erroreCod: string;
  erroreDes: string;
  erroreDettaglio: string;
}

export interface TokenInfo {
  issued: string;
  expires: string;
  token: string;
}

export interface ElencoSchedineEsito {
  schedineValide: number;
  dettaglio: EsitoOperazione[];
}

export interface SchedineResult {
  esito: EsitoOperazione;
  result: ElencoSchedineEsito;
}

export interface RicevutaResult {
  esito: EsitoOperazione;
  pdf: Uint8Array | null;
}

export interface TabellaResult {
  esito: EsitoOperazione;
  csv: string;
}

// ── Dati Schedina ─────────────────────────────────────

/** Dati necessari per costruire una riga schedina (168 char) */
export interface DatiSchedina {
  tipoAlloggiato: TipoAlloggiato;
  dataArrivo: Date;
  giorniPermanenza: number;     // 1-30
  cognome: string;              // max 50 chars
  nome: string;                 // max 30 chars
  sesso: Sesso;                 // '1'=M, '2'=F
  dataNascita: Date;
  comuneNascita?: string;       // codice ISTAT 9 cifre (se Italia)
  provinciaNascita?: string;    // sigla 2 chars (se Italia)
  statoNascita: string;         // codice stato 9 cifre
  cittadinanza: string;         // codice stato 9 cifre
  // Campi documento (obbligatori per tipo 16/17/18, blank per 19/20)
  tipoDocumento?: string;       // codice 5 chars (IDENT, PASOR...)
  numeroDocumento?: string;     // max 20 chars
  luogoRilascioDoc?: string;    // codice comune o stato 9 cifre
}

// ── Codici Ministeriali ───────────────────────────────

export interface ComuneCode {
  c: string;   // codice ISTAT 9 cifre
  n: string;   // nome comune
  p: string;   // sigla provincia (PD, MI...)
}

export interface StatoCode {
  c: string;   // codice 9 cifre
  n: string;   // nome stato
}

export interface DocumentoCode {
  c: string;   // codice 5 chars (IDENT, PASOR...)
  n: string;   // descrizione
}

// ── Tracciato Record ──────────────────────────────────

/** Posizioni dei campi nel tracciato a 168 caratteri (TABELLA 1) */
export const TRACCIATO = {
  TIPO_ALLOGGIATO:    { da: 0,   a: 1,   len: 2  },
  DATA_ARRIVO:        { da: 2,   a: 11,  len: 10 },
  GIORNI_PERMANENZA:  { da: 12,  a: 13,  len: 2  },
  COGNOME:            { da: 14,  a: 63,  len: 50 },
  NOME:               { da: 64,  a: 93,  len: 30 },
  SESSO:              { da: 94,  a: 94,  len: 1  },
  DATA_NASCITA:       { da: 95,  a: 104, len: 10 },
  COMUNE_NASCITA:     { da: 105, a: 113, len: 9  },
  PROVINCIA_NASCITA:  { da: 114, a: 115, len: 2  },
  STATO_NASCITA:      { da: 116, a: 124, len: 9  },
  CITTADINANZA:       { da: 125, a: 133, len: 9  },
  TIPO_DOCUMENTO:     { da: 134, a: 138, len: 5  },
  NUMERO_DOCUMENTO:   { da: 139, a: 158, len: 20 },
  LUOGO_RILASCIO:     { da: 159, a: 167, len: 9  },
} as const;
