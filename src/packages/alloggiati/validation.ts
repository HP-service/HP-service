// ============================================
// Alloggiati Web - Validazione Pre-invio
// Riproduce i controlli del server Alloggiati
// per evitare errori SCHEDINA_CAMPO_NON_CORRETTO.
// ============================================

import {
  type DatiSchedina,
  CODICE_ITALIA,
  TIPI_CON_DOCUMENTO,
  SCHEDINA_LENGTH,
} from './types';
import { getComuneByCodice, getStatoByCodice, getDocumentoByCodice } from './codes';

export interface ValidationError {
  campo: string;
  messaggio: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Valida una singola schedina prima dell'invio.
 * Riproduce i controlli del tracciato TABELLA 1.
 */
export function validateSchedina(dati: DatiSchedina): ValidationResult {
  const errors: ValidationError[] = [];

  // ── Tipo Alloggiato ──
  if (!['16', '17', '18', '19', '20'].includes(dati.tipoAlloggiato)) {
    errors.push({ campo: 'tipoAlloggiato', messaggio: 'Tipo alloggiato non valido (16-20)' });
  }

  // ── Giorni Permanenza ──
  if (dati.giorniPermanenza < 1 || dati.giorniPermanenza > 30) {
    errors.push({ campo: 'giorniPermanenza', messaggio: 'Giorni permanenza deve essere 1-30' });
  }

  // ── Data Arrivo ──
  if (!dati.dataArrivo || isNaN(dati.dataArrivo.getTime())) {
    errors.push({ campo: 'dataArrivo', messaggio: 'Data arrivo non valida' });
  }

  // ── Cognome ──
  if (!dati.cognome || dati.cognome.trim().length === 0) {
    errors.push({ campo: 'cognome', messaggio: 'Cognome obbligatorio' });
  } else if (dati.cognome.length > 50) {
    errors.push({ campo: 'cognome', messaggio: 'Cognome max 50 caratteri' });
  }

  // ── Nome ──
  if (!dati.nome || dati.nome.trim().length === 0) {
    errors.push({ campo: 'nome', messaggio: 'Nome obbligatorio' });
  } else if (dati.nome.length > 30) {
    errors.push({ campo: 'nome', messaggio: 'Nome max 30 caratteri' });
  }

  // ── Sesso ──
  if (dati.sesso !== '1' && dati.sesso !== '2') {
    errors.push({ campo: 'sesso', messaggio: 'Sesso deve essere 1 (M) o 2 (F)' });
  }

  // ── Data Nascita ──
  if (!dati.dataNascita || isNaN(dati.dataNascita.getTime())) {
    errors.push({ campo: 'dataNascita', messaggio: 'Data di nascita non valida' });
  }

  // ── Stato Nascita ──
  if (!dati.statoNascita || dati.statoNascita.trim().length === 0) {
    errors.push({ campo: 'statoNascita', messaggio: 'Stato di nascita obbligatorio' });
  } else {
    const stato = getStatoByCodice(dati.statoNascita);
    if (!stato) {
      errors.push({ campo: 'statoNascita', messaggio: `Codice stato nascita non valido: ${dati.statoNascita}` });
    }
  }

  // ── Comune/Provincia Nascita (obbligatori se Italia) ──
  if (dati.statoNascita === CODICE_ITALIA) {
    if (!dati.comuneNascita || dati.comuneNascita.trim().length === 0) {
      errors.push({ campo: 'comuneNascita', messaggio: 'Comune di nascita obbligatorio per cittadini italiani' });
    } else {
      const comune = getComuneByCodice(dati.comuneNascita);
      if (!comune) {
        errors.push({ campo: 'comuneNascita', messaggio: `Codice comune nascita non valido: ${dati.comuneNascita}` });
      }
    }

    if (!dati.provinciaNascita || dati.provinciaNascita.trim().length !== 2) {
      errors.push({ campo: 'provinciaNascita', messaggio: 'Provincia di nascita obbligatoria (2 caratteri) per nati in Italia' });
    }
  }

  // ── Cittadinanza ──
  if (!dati.cittadinanza || dati.cittadinanza.trim().length === 0) {
    errors.push({ campo: 'cittadinanza', messaggio: 'Cittadinanza obbligatoria' });
  } else {
    const citt = getStatoByCodice(dati.cittadinanza);
    if (!citt) {
      errors.push({ campo: 'cittadinanza', messaggio: `Codice cittadinanza non valido: ${dati.cittadinanza}` });
    }
  }

  // ── Documento (obbligatorio per tipo 16/17/18) ──
  const richiedeDoc = TIPI_CON_DOCUMENTO.includes(dati.tipoAlloggiato);

  if (richiedeDoc) {
    if (!dati.tipoDocumento || dati.tipoDocumento.trim().length === 0) {
      errors.push({ campo: 'tipoDocumento', messaggio: 'Tipo documento obbligatorio' });
    } else {
      const doc = getDocumentoByCodice(dati.tipoDocumento);
      if (!doc) {
        errors.push({ campo: 'tipoDocumento', messaggio: `Codice tipo documento non valido: ${dati.tipoDocumento}` });
      }
    }

    if (!dati.numeroDocumento || dati.numeroDocumento.trim().length === 0) {
      errors.push({ campo: 'numeroDocumento', messaggio: 'Numero documento obbligatorio' });
    } else if (dati.numeroDocumento.length > 20) {
      errors.push({ campo: 'numeroDocumento', messaggio: 'Numero documento max 20 caratteri' });
    }

    if (!dati.luogoRilascioDoc || dati.luogoRilascioDoc.trim().length === 0) {
      errors.push({ campo: 'luogoRilascioDoc', messaggio: 'Luogo rilascio documento obbligatorio' });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Valida un elenco completo di schedine.
 * Restituisce errori aggregati con indice della schedina.
 */
export function validateElenco(
  schedine: DatiSchedina[]
): { valid: boolean; errorsByIndex: Map<number, ValidationError[]> } {
  const errorsByIndex = new Map<number, ValidationError[]>();
  let allValid = true;

  schedine.forEach((s, i) => {
    const result = validateSchedina(s);
    if (!result.valid) {
      allValid = false;
      errorsByIndex.set(i, result.errors);
    }
  });

  return { valid: allValid, errorsByIndex };
}

/**
 * Valida la lunghezza di una stringa schedina già costruita.
 */
export function validateRigaLength(riga: string): boolean {
  return riga.length === SCHEDINA_LENGTH;
}
