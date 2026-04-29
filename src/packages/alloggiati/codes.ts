// ============================================
// Alloggiati Web - Codici Ministeriali
// Carica i JSON statici (convertiti dai CSV ufficiali)
// e fornisce funzioni di ricerca per autocomplete.
// ============================================

import type { ComuneCode, StatoCode, DocumentoCode } from './types';

// Import statici dei JSON (Next.js li bundla automaticamente)
import comuniData from './data/comuni.json';
import statiData from './data/stati.json';
import documentiData from './data/documenti.json';
import tipiAlloggiatoData from './data/tipi-alloggiato.json';

// ── Cache tipizzata ───────────────────────────

const comuni: ComuneCode[] = comuniData as ComuneCode[];
const stati: StatoCode[] = statiData as StatoCode[];
const documenti: DocumentoCode[] = documentiData as DocumentoCode[];
const tipiAlloggiato: DocumentoCode[] = tipiAlloggiatoData as DocumentoCode[];

// Map per lookup diretto per codice
const comuniMap = new Map<string, ComuneCode>();
comuni.forEach((c) => comuniMap.set(c.c, c));

const statiMap = new Map<string, StatoCode>();
stati.forEach((s) => statiMap.set(s.c, s));

const documentiMap = new Map<string, DocumentoCode>();
documenti.forEach((d) => documentiMap.set(d.c, d));

// ── Ricerca Comuni ────────────────────────────

/**
 * Cerca comuni per nome (case-insensitive, startsWith ha priorità).
 * Restituisce al massimo `limit` risultati.
 */
export function searchComuni(query: string, limit = 20): ComuneCode[] {
  if (!query || query.length < 2) return [];
  const q = query.toUpperCase().trim();

  // Prima quelli che iniziano con la query, poi quelli che contengono
  const starts: ComuneCode[] = [];
  const contains: ComuneCode[] = [];

  for (const c of comuni) {
    if (starts.length + contains.length >= limit * 2) break;
    if (c.n.startsWith(q)) {
      starts.push(c);
    } else if (c.n.includes(q)) {
      contains.push(c);
    }
  }

  return [...starts, ...contains].slice(0, limit);
}

/**
 * Lookup comune per codice ISTAT.
 */
export function getComuneByCodice(codice: string): ComuneCode | undefined {
  return comuniMap.get(codice);
}

/**
 * Restituisce tutti i comuni (per popolare liste complete).
 */
export function getAllComuni(): ComuneCode[] {
  return comuni;
}

// ── Ricerca Stati ─────────────────────────────

/**
 * Cerca stati/nazioni per nome.
 */
export function searchStati(query: string, limit = 20): StatoCode[] {
  if (!query || query.length < 2) return [];
  const q = query.toUpperCase().trim();

  const starts: StatoCode[] = [];
  const contains: StatoCode[] = [];

  for (const s of stati) {
    if (starts.length + contains.length >= limit * 2) break;
    if (s.n.startsWith(q)) {
      starts.push(s);
    } else if (s.n.includes(q)) {
      contains.push(s);
    }
  }

  return [...starts, ...contains].slice(0, limit);
}

/**
 * Lookup stato per codice.
 */
export function getStatoByCodice(codice: string): StatoCode | undefined {
  return statiMap.get(codice);
}

/**
 * Restituisce tutti gli stati.
 */
export function getAllStati(): StatoCode[] {
  return stati;
}

// ── Documenti ─────────────────────────────────

/**
 * Restituisce tutti i tipi documento.
 * Per il form check-in: select dropdown.
 */
export function getAllDocumenti(): DocumentoCode[] {
  return documenti;
}

/**
 * Lookup documento per codice (IDENT, PASOR, etc.)
 */
export function getDocumentoByCodice(codice: string): DocumentoCode | undefined {
  return documentiMap.get(codice);
}

/**
 * Documenti più comuni in cima (per UX migliore).
 */
export function getDocumentiPrioritized(): DocumentoCode[] {
  const priorityCodes = ['IDENT', 'IDELE', 'PASOR', 'PATEN'];
  const priority = documenti.filter((d) => priorityCodes.includes(d.c));
  const rest = documenti.filter((d) => !priorityCodes.includes(d.c));
  return [...priority, ...rest];
}

// ── Tipi Alloggiato ───────────────────────────

export function getAllTipiAlloggiato(): DocumentoCode[] {
  return tipiAlloggiato;
}
