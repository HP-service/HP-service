// ============================================
// Alloggiati Web - SOAP Client
// Client SOAP via fetch() raw XML.
// Endpoint: https://alloggiatiweb.poliziadistato.it/service/service.asmx
// Protocollo: SOAP 1.2, namespace AlloggiatiService
// ============================================

import { XMLParser } from 'fast-xml-parser';
import type {
  AlloggiatiCredentials,
  EsitoOperazione,
  TokenInfo,
  SchedineResult,
  ElencoSchedineEsito,
  RicevutaResult,
  TabellaResult,
} from './types';

const ENDPOINT = 'https://alloggiatiweb.poliziadistato.it/service/service.asmx';
const NS = 'AlloggiatiService';

const parser = new XMLParser({
  ignoreAttributes: false,
  removeNSPrefix: true,
  parseTagValue: true,
  isArray: (name) => name === 'EsitoOperazioneServizio',
});

// ── Utility SOAP ──────────────────────────────

function buildEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:all="${NS}">
  <soap:Header/>
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;
}

async function soapCall(action: string, envelope: string): Promise<Record<string, unknown>> {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': `application/soap+xml; charset=utf-8; action="${NS}/${action}"`,
    },
    body: envelope,
  });

  if (!res.ok) {
    throw new Error(`SOAP HTTP Error ${res.status}: ${res.statusText}`);
  }

  const xml = await res.text();
  const parsed = parser.parse(xml);

  // Naviga dentro Envelope > Body
  const body = parsed?.Envelope?.Body;
  if (!body) {
    throw new Error('Risposta SOAP non valida: Body mancante');
  }

  return body;
}

function parseEsito(obj: Record<string, unknown>): EsitoOperazione {
  return {
    esito: obj.esito === true || obj.esito === 'true',
    erroreCod: String(obj.ErroreCod || ''),
    erroreDes: String(obj.ErroreDes || ''),
    erroreDettaglio: String(obj.ErroreDettaglio || ''),
  };
}

// ── Metodo 1: GenerateToken ───────────────────

export async function generateToken(
  creds: AlloggiatiCredentials
): Promise<{ token: TokenInfo; esito: EsitoOperazione }> {
  const envelope = buildEnvelope(`
    <all:GenerateToken>
      <all:Utente>${escapeXml(creds.username)}</all:Utente>
      <all:Password>${escapeXml(creds.password)}</all:Password>
      <all:WsKey>${escapeXml(creds.wskey)}</all:WsKey>
    </all:GenerateToken>
  `);

  const body = await soapCall('GenerateToken', envelope);
  const resp = body.GenerateTokenResponse as Record<string, unknown>;
  const tokenResult = resp.GenerateTokenResult as Record<string, unknown>;
  const result = resp.result as Record<string, unknown>;

  return {
    token: {
      issued: String(tokenResult?.issued || ''),
      expires: String(tokenResult?.expires || ''),
      token: String(tokenResult?.token || ''),
    },
    esito: parseEsito(result || tokenResult),
  };
}

// ── Metodo 2: Authentication_Test ─────────────

export async function authenticationTest(
  utente: string,
  token: string
): Promise<EsitoOperazione> {
  const envelope = buildEnvelope(`
    <all:Authentication_Test>
      <all:Utente>${escapeXml(utente)}</all:Utente>
      <all:token>${escapeXml(token)}</all:token>
    </all:Authentication_Test>
  `);

  const body = await soapCall('Authentication_Test', envelope);
  const resp = body.Authentication_TestResponse as Record<string, unknown>;
  const result = resp.Authentication_TestResult as Record<string, unknown>;

  return parseEsito(result);
}

// ── Metodo 3: Test (dry-run schedine) ─────────

export async function testSchedine(
  utente: string,
  token: string,
  righe: string[]
): Promise<SchedineResult> {
  const stringhe = righe
    .map((r) => `<all:string>${escapeXml(r)}</all:string>`)
    .join('\n            ');

  const envelope = buildEnvelope(`
    <all:Test>
      <all:Utente>${escapeXml(utente)}</all:Utente>
      <all:token>${escapeXml(token)}</all:token>
      <all:ElencoSchedine>
        ${stringhe}
      </all:ElencoSchedine>
    </all:Test>
  `);

  const body = await soapCall('Test', envelope);
  return parseSchedineResponse(body, 'TestResponse', 'TestResult');
}

// ── Metodo 4: Send (invio reale) ──────────────

export async function sendSchedine(
  utente: string,
  token: string,
  righe: string[]
): Promise<SchedineResult> {
  const stringhe = righe
    .map((r) => `<all:string>${escapeXml(r)}</all:string>`)
    .join('\n            ');

  const envelope = buildEnvelope(`
    <all:Send>
      <all:Utente>${escapeXml(utente)}</all:Utente>
      <all:token>${escapeXml(token)}</all:token>
      <all:ElencoSchedine>
        ${stringhe}
      </all:ElencoSchedine>
    </all:Send>
  `);

  const body = await soapCall('Send', envelope);
  return parseSchedineResponse(body, 'SendResponse', 'SendResult');
}

// ── Metodo 5: Ricevuta (download PDF) ─────────

export async function downloadRicevuta(
  utente: string,
  token: string,
  data: Date
): Promise<RicevutaResult> {
  const dataStr = data.toISOString().split('T')[0] + 'T00:00:00';

  const envelope = buildEnvelope(`
    <all:Ricevuta>
      <all:Utente>${escapeXml(utente)}</all:Utente>
      <all:token>${escapeXml(token)}</all:token>
      <all:Data>${dataStr}</all:Data>
    </all:Ricevuta>
  `);

  const body = await soapCall('Ricevuta', envelope);
  const resp = body.RicevutaResponse as Record<string, unknown>;
  const result = resp.RicevutaResult as Record<string, unknown>;
  const pdfBase64 = resp.PDF as string | undefined;

  return {
    esito: parseEsito(result),
    pdf: pdfBase64 ? base64ToUint8Array(pdfBase64) : null,
  };
}

// ── Metodo 6: Tabella (download tabelle CSV) ──

export async function downloadTabella(
  utente: string,
  token: string,
  tipo: 'Luoghi' | 'Tipi_Documento' | 'Tipi_Alloggiato' | 'TipoErrore' | 'ListaAppartamenti'
): Promise<TabellaResult> {
  const envelope = buildEnvelope(`
    <all:Tabella>
      <all:Utente>${escapeXml(utente)}</all:Utente>
      <all:token>${escapeXml(token)}</all:token>
      <all:tipo>${tipo}</all:tipo>
    </all:Tabella>
  `);

  const body = await soapCall('Tabella', envelope);
  const resp = body.TabellaResponse as Record<string, unknown>;
  const result = resp.TabellaResult as Record<string, unknown>;
  const csv = String(resp.CSV || '');

  return {
    esito: parseEsito(result),
    csv,
  };
}

// ── Helper interni ────────────────────────────

function parseSchedineResponse(
  body: Record<string, unknown>,
  responseName: string,
  resultName: string
): SchedineResult {
  const resp = body[responseName] as Record<string, unknown>;
  const esitoResult = resp[resultName] as Record<string, unknown>;
  const result = resp.result as Record<string, unknown>;

  const dettaglioRaw = result?.Dettaglio as Record<string, unknown> | undefined;
  const dettaglioArray = (
    dettaglioRaw?.EsitoOperazioneServizio || []
  ) as Record<string, unknown>[];

  const schedineEsito: ElencoSchedineEsito = {
    schedineValide: Number(result?.SchedineValide || 0),
    dettaglio: (Array.isArray(dettaglioArray) ? dettaglioArray : [dettaglioArray]).map(parseEsito),
  };

  return {
    esito: parseEsito(esitoResult),
    result: schedineEsito,
  };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
