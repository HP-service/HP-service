"use client"

import { useMemo } from "react"
import { Badge } from "@ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@ui/table"
import { CheckCircle2, XCircle } from "lucide-react"
import { getStatoByCodice, getComuneByCodice, getDocumentoByCodice } from "@alloggiati/codes"
import { CODICE_ITALIA, TIPO_ALLOGGIATO } from "@alloggiati/types"
import type { PrimaryGuestData } from "./primary-guest-form"
import type { AccompagnatoreData } from "./accompagnatori-list"

type Props = {
  primary: PrimaryGuestData
  primaryType: string  // "16" | "17"
  accompagnatori: AccompagnatoreData[]
}

// ── Helpers ──────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  [TIPO_ALLOGGIATO.OSPITE_SINGOLO]: "Ospite singolo",
  [TIPO_ALLOGGIATO.CAPO_FAMIGLIA]: "Capo famiglia",
  [TIPO_ALLOGGIATO.CAPO_GRUPPO]: "Capo gruppo",
  [TIPO_ALLOGGIATO.FAMILIARE]: "Familiare",
  [TIPO_ALLOGGIATO.MEMBRO_GRUPPO]: "Membro gruppo",
}

function statoLabel(code: string): string {
  if (!code) return "—"
  const s = getStatoByCodice(code)
  return s ? s.n : code
}

function comuneLabel(code: string | undefined): string {
  if (!code) return "—"
  const c = getComuneByCodice(code)
  return c ? `${c.n} (${c.p})` : code
}

function docLabel(code: string | undefined): string {
  if (!code) return "—"
  const d = getDocumentoByCodice(code)
  return d ? d.n : code
}

function sessoLabel(code: string): string {
  return code === "1" ? "M" : code === "2" ? "F" : "—"
}

function FieldCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      {ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <XCircle className="h-3.5 w-3.5 text-destructive" />
      )}
      <span className={ok ? "" : "text-destructive font-medium"}>{label}</span>
    </span>
  )
}

// ── Row component ────────────────────────────

function GuestRow({
  tipo,
  cognome,
  nome,
  sesso,
  dataNascita,
  statoNascita,
  comuneNascita,
  cittadinanza,
  tipoDocumento,
  numeroDocumento,
  luogoRilascio,
  requiresDoc,
}: {
  tipo: string
  cognome: string
  nome: string
  sesso: string
  dataNascita: string
  statoNascita: string
  comuneNascita?: string
  cittadinanza: string
  tipoDocumento?: string
  numeroDocumento?: string
  luogoRilascio?: string
  requiresDoc: boolean
}) {
  const isItalia = statoNascita === CODICE_ITALIA
  const comuneOk = !isItalia || !!comuneNascita

  return (
    <TableRow>
      <TableCell>
        <Badge variant="outline" className="text-xs whitespace-nowrap">
          {TIPO_LABELS[tipo] || tipo}
        </Badge>
      </TableCell>
      <TableCell className="font-medium">
        <FieldCheck ok={!!cognome} label={cognome || "mancante"} />
      </TableCell>
      <TableCell>
        <FieldCheck ok={!!nome} label={nome || "mancante"} />
      </TableCell>
      <TableCell>{sessoLabel(sesso)}</TableCell>
      <TableCell>
        <FieldCheck ok={!!dataNascita} label={dataNascita || "mancante"} />
      </TableCell>
      <TableCell>
        <FieldCheck ok={!!statoNascita} label={statoLabel(statoNascita)} />
        {isItalia && (
          <div className="text-xs text-muted-foreground">
            <FieldCheck ok={comuneOk} label={comuneLabel(comuneNascita)} />
          </div>
        )}
      </TableCell>
      <TableCell>
        <FieldCheck ok={!!cittadinanza} label={statoLabel(cittadinanza)} />
      </TableCell>
      <TableCell>
        {requiresDoc ? (
          <div className="space-y-0.5">
            <FieldCheck ok={!!tipoDocumento} label={docLabel(tipoDocumento)} />
            {tipoDocumento && (
              <div className="text-xs text-muted-foreground">
                <FieldCheck ok={!!numeroDocumento} label={numeroDocumento || "N° mancante"} />
              </div>
            )}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Non richiesto</span>
        )}
      </TableCell>
    </TableRow>
  )
}

// ── Main Component ───────────────────────────

export function ReviewSummary({ primary, primaryType, accompagnatori }: Props) {
  const allValid = useMemo(() => {
    // Controlla ospite principale
    const pOk = !!(
      primary.cognome &&
      primary.nome &&
      primary.sesso &&
      primary.data_nascita &&
      primary.stato_nascita &&
      primary.cittadinanza &&
      primary.tipo_documento &&
      primary.numero_documento &&
      primary.luogo_rilascio &&
      (primary.stato_nascita !== CODICE_ITALIA || primary.comune_nascita)
    )
    if (!pOk) return false

    // Controlla accompagnatori
    for (const a of accompagnatori) {
      if (!a.cognome || !a.nome || !a.sesso || !a.data_nascita || !a.stato_nascita || !a.cittadinanza) return false
      if (a.stato_nascita === CODICE_ITALIA && !a.comune_nascita) return false
    }

    return true
  }, [primary, accompagnatori])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {allValid ? (
          <Badge variant="default" className="bg-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Tutti i dati compilati
          </Badge>
        ) : (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Dati incompleti
          </Badge>
        )}
        <span className="text-sm text-muted-foreground">
          {1 + accompagnatori.length} schedina/e totale
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Tipo</TableHead>
              <TableHead>Cognome</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead className="w-[50px]">Sesso</TableHead>
              <TableHead>Nascita</TableHead>
              <TableHead>Luogo nascita</TableHead>
              <TableHead>Cittadinanza</TableHead>
              <TableHead>Documento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Ospite principale */}
            <GuestRow
              tipo={primaryType}
              cognome={primary.cognome}
              nome={primary.nome}
              sesso={primary.sesso}
              dataNascita={primary.data_nascita}
              statoNascita={primary.stato_nascita}
              comuneNascita={primary.comune_nascita}
              cittadinanza={primary.cittadinanza}
              tipoDocumento={primary.tipo_documento}
              numeroDocumento={primary.numero_documento}
              luogoRilascio={primary.luogo_rilascio}
              requiresDoc
            />

            {/* Accompagnatori */}
            {accompagnatori.map((acc, i) => (
              <GuestRow
                key={i}
                tipo={acc.guest_type}
                cognome={acc.cognome}
                nome={acc.nome}
                sesso={acc.sesso}
                dataNascita={acc.data_nascita}
                statoNascita={acc.stato_nascita}
                comuneNascita={acc.comune_nascita}
                cittadinanza={acc.cittadinanza}
                requiresDoc={false}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
