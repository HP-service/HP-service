"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@ui/command"
import { Check, ChevronRight, ChevronsUpDown } from "lucide-react"
import { cn } from "@/src/packages/utils"
import {
  searchComuni,
  searchStati,
  getComuneByCodice,
  getStatoByCodice,
  getDocumentiPrioritized,
} from "@alloggiati/codes"
import { CODICE_ITALIA, SESSO } from "@alloggiati/types"

// ── Types ────────────────────────────────────

export type PrimaryGuestData = {
  cognome: string
  nome: string
  sesso: "1" | "2"
  data_nascita: string          // gg/mm/aaaa
  stato_nascita: string         // codice 9 cifre
  comune_nascita?: string       // codice ISTAT 9 cifre
  provincia_nascita?: string    // sigla 2 chars
  cittadinanza: string          // codice 9 cifre
  tipo_documento: string        // codice 5 chars
  numero_documento: string
  luogo_rilascio: string        // codice 9 cifre
}

type Props = {
  guest: Record<string, unknown> | null
  initialData: PrimaryGuestData | null
  onSave: (data: PrimaryGuestData) => void
}

// ── Helpers ──────────────────────────────────

function splitFullName(fullName: string): { nome: string; cognome: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) return { nome: "", cognome: parts[0] || "" }
  const cognome = parts[parts.length - 1]
  const nome = parts.slice(0, -1).join(" ")
  return { nome, cognome }
}

function isoToItDate(isoDate: string | null | undefined): string {
  if (!isoDate) return ""
  const d = new Date(isoDate)
  if (isNaN(d.getTime())) return ""
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`
}

function itDateToIso(itDate: string): string {
  const match = itDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ""
  return `${match[3]}-${match[2]}-${match[1]}`
}

// ── Combobox generico ────────────────────────

function ComboboxSearch({
  label,
  placeholder,
  value,
  displayValue,
  onSearch,
  onSelect,
  error,
}: {
  label: string
  placeholder: string
  value: string
  displayValue: string
  onSearch: (q: string) => { value: string; label: string; sub?: string }[]
  onSelect: (value: string) => void
  error?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const results = useMemo(() => {
    if (query.length < 2) return []
    return onSearch(query)
  }, [query, onSearch])

  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground"
            )}
          >
            {value ? displayValue : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={`Cerca ${label.toLowerCase()}...`}
              value={query}
              onValueChange={setQuery}
            />
            <CommandList>
              {query.length >= 2 && results.length === 0 && (
                <CommandEmpty>Nessun risultato</CommandEmpty>
              )}
              {results.length > 0 && (
                <CommandGroup>
                  {results.map((item) => (
                    <CommandItem
                      key={item.value}
                      value={item.value}
                      onSelect={() => {
                        onSelect(item.value)
                        setOpen(false)
                        setQuery("")
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          value === item.value ? "opacity-100" : "opacity-0"
                        )}
                      />
                      <div>
                        <span>{item.label}</span>
                        {item.sub && (
                          <span className="ml-1 text-xs text-muted-foreground">({item.sub})</span>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ── Main Component ───────────────────────────

export function PrimaryGuestForm({ guest, initialData, onSave }: Props) {
  // Pre-fill dai dati guest esistenti
  const defaultName = guest?.full_name ? splitFullName(guest.full_name as string) : { nome: "", cognome: "" }

  const [cognome, setCognome] = useState(initialData?.cognome || (guest?.last_name as string) || defaultName.cognome)
  const [nome, setNome] = useState(initialData?.nome || (guest?.first_name as string) || defaultName.nome)
  const [sesso, setSesso] = useState<"1" | "2" | "">(initialData?.sesso || (guest?.gender as "1" | "2") || "")
  const [dataNascita, setDataNascita] = useState(
    initialData?.data_nascita || isoToItDate(guest?.date_of_birth as string)
  )
  const [statoNascita, setStatoNascita] = useState(initialData?.stato_nascita || (guest?.country_of_birth as string) || "")
  const [comuneNascita, setComuneNascita] = useState(initialData?.comune_nascita || (guest?.place_of_birth as string) || "")
  const [provinciaNascita, setProvinciaNascita] = useState(initialData?.provincia_nascita || (guest?.province_of_birth as string) || "")
  const [cittadinanza, setCittadinanza] = useState(initialData?.cittadinanza || (guest?.citizenship as string) || "")
  const [tipoDocumento, setTipoDocumento] = useState(initialData?.tipo_documento || (guest?.document_type as string) || "")
  const [numeroDocumento, setNumeroDocumento] = useState(initialData?.numero_documento || (guest?.document_number as string) || "")
  const [luogoRilascio, setLuogoRilascio] = useState(initialData?.luogo_rilascio || (guest?.document_issued_by as string) || "")
  const [luogoRilascioEstero, setLuogoRilascioEstero] = useState(false)

  const [errors, setErrors] = useState<Record<string, string>>({})

  // Documenti prioritizzati
  const documenti = useMemo(() => getDocumentiPrioritized(), [])

  // Display values per combobox
  const statoNascitaDisplay = useMemo(() => {
    if (!statoNascita) return ""
    const s = getStatoByCodice(statoNascita)
    return s ? s.n : statoNascita
  }, [statoNascita])

  const comuneNascitaDisplay = useMemo(() => {
    if (!comuneNascita) return ""
    const c = getComuneByCodice(comuneNascita)
    return c ? `${c.n} (${c.p})` : comuneNascita
  }, [comuneNascita])

  const cittadinanzaDisplay = useMemo(() => {
    if (!cittadinanza) return ""
    const s = getStatoByCodice(cittadinanza)
    return s ? s.n : cittadinanza
  }, [cittadinanza])

  const luogoRilascioDisplay = useMemo(() => {
    if (!luogoRilascio) return ""
    if (luogoRilascioEstero) {
      const s = getStatoByCodice(luogoRilascio)
      return s ? s.n : luogoRilascio
    }
    const c = getComuneByCodice(luogoRilascio)
    return c ? `${c.n} (${c.p})` : luogoRilascio
  }, [luogoRilascio, luogoRilascioEstero])

  const isItalia = statoNascita === CODICE_ITALIA

  // Search callbacks
  const searchComuniCb = useCallback((q: string) => {
    return searchComuni(q, 15).map((c) => ({
      value: c.c,
      label: c.n,
      sub: c.p,
    }))
  }, [])

  const searchStatiCb = useCallback((q: string) => {
    return searchStati(q, 15).map((s) => ({
      value: s.c,
      label: s.n,
    }))
  }, [])

  // ── Validazione ────────────────────────────

  function validate(): boolean {
    const errs: Record<string, string> = {}

    if (!cognome.trim()) errs.cognome = "Cognome obbligatorio"
    else if (cognome.length > 50) errs.cognome = "Max 50 caratteri"

    if (!nome.trim()) errs.nome = "Nome obbligatorio"
    else if (nome.length > 30) errs.nome = "Max 30 caratteri"

    if (!sesso) errs.sesso = "Sesso obbligatorio"

    if (!dataNascita) errs.data_nascita = "Data di nascita obbligatoria"
    else if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dataNascita)) errs.data_nascita = "Formato: gg/mm/aaaa"

    if (!statoNascita) errs.stato_nascita = "Stato di nascita obbligatorio"

    if (isItalia && !comuneNascita) errs.comune_nascita = "Comune obbligatorio per Italia"

    if (!cittadinanza) errs.cittadinanza = "Cittadinanza obbligatoria"

    if (!tipoDocumento) errs.tipo_documento = "Tipo documento obbligatorio"
    if (!numeroDocumento.trim()) errs.numero_documento = "Numero documento obbligatorio"
    else if (numeroDocumento.length > 20) errs.numero_documento = "Max 20 caratteri"

    if (!luogoRilascio) errs.luogo_rilascio = "Luogo rilascio obbligatorio"

    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  function handleSubmit() {
    if (!validate()) return

    onSave({
      cognome: cognome.trim(),
      nome: nome.trim(),
      sesso: sesso as "1" | "2",
      data_nascita: dataNascita,
      stato_nascita: statoNascita,
      comune_nascita: isItalia ? comuneNascita : undefined,
      provincia_nascita: isItalia ? provinciaNascita : undefined,
      cittadinanza,
      tipo_documento: tipoDocumento,
      numero_documento: numeroDocumento.trim(),
      luogo_rilascio: luogoRilascio,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dati ospite principale</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Anagrafica */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Cognome *</Label>
            <Input
              value={cognome}
              onChange={(e) => setCognome(e.target.value)}
              maxLength={50}
              placeholder="Es. ROSSI"
            />
            {errors.cognome && <p className="text-xs text-destructive">{errors.cognome}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Nome *</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              maxLength={30}
              placeholder="Es. MARIO"
            />
            {errors.nome && <p className="text-xs text-destructive">{errors.nome}</p>}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Sesso */}
          <div className="space-y-1.5">
            <Label className="text-sm">Sesso *</Label>
            <Select value={sesso} onValueChange={(v) => setSesso(v as "1" | "2")}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SESSO.M}>Maschio</SelectItem>
                <SelectItem value={SESSO.F}>Femmina</SelectItem>
              </SelectContent>
            </Select>
            {errors.sesso && <p className="text-xs text-destructive">{errors.sesso}</p>}
          </div>

          {/* Data nascita */}
          <div className="space-y-1.5">
            <Label className="text-sm">Data di nascita *</Label>
            <Input
              type="date"
              value={itDateToIso(dataNascita)}
              onChange={(e) => {
                const val = e.target.value
                if (val) {
                  const [y, m, d] = val.split("-")
                  setDataNascita(`${d}/${m}/${y}`)
                } else {
                  setDataNascita("")
                }
              }}
            />
            {errors.data_nascita && <p className="text-xs text-destructive">{errors.data_nascita}</p>}
          </div>

          {/* Cittadinanza */}
          <ComboboxSearch
            label="Cittadinanza *"
            placeholder="Cerca stato..."
            value={cittadinanza}
            displayValue={cittadinanzaDisplay}
            onSearch={searchStatiCb}
            onSelect={setCittadinanza}
            error={errors.cittadinanza}
          />
        </div>

        {/* Luogo di nascita */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <ComboboxSearch
            label="Stato di nascita *"
            placeholder="Cerca stato..."
            value={statoNascita}
            displayValue={statoNascitaDisplay}
            onSearch={searchStatiCb}
            onSelect={(code) => {
              setStatoNascita(code)
              if (code !== CODICE_ITALIA) {
                setComuneNascita("")
                setProvinciaNascita("")
              }
            }}
            error={errors.stato_nascita}
          />

          {isItalia && (
            <>
              <ComboboxSearch
                label="Comune di nascita *"
                placeholder="Cerca comune..."
                value={comuneNascita}
                displayValue={comuneNascitaDisplay}
                onSearch={searchComuniCb}
                onSelect={(code) => {
                  setComuneNascita(code)
                  const c = getComuneByCodice(code)
                  if (c) setProvinciaNascita(c.p)
                }}
                error={errors.comune_nascita}
              />
              <div className="space-y-1.5">
                <Label className="text-sm">Provincia</Label>
                <Input value={provinciaNascita} readOnly className="bg-muted" />
              </div>
            </>
          )}
        </div>

        {/* Documento */}
        <div className="border-t pt-4">
          <h3 className="mb-4 text-sm font-medium">Documento di riconoscimento</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Tipo documento *</Label>
              <Select value={tipoDocumento} onValueChange={setTipoDocumento}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona tipo..." />
                </SelectTrigger>
                <SelectContent>
                  {documenti.map((d) => (
                    <SelectItem key={d.c} value={d.c}>
                      {d.n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.tipo_documento && <p className="text-xs text-destructive">{errors.tipo_documento}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">Numero documento *</Label>
              <Input
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                maxLength={20}
                placeholder="Es. CA12345AB"
              />
              {errors.numero_documento && <p className="text-xs text-destructive">{errors.numero_documento}</p>}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Luogo rilascio *</Label>
                <button
                  type="button"
                  className="text-xs text-primary underline"
                  onClick={() => {
                    setLuogoRilascioEstero(!luogoRilascioEstero)
                    setLuogoRilascio("")
                  }}
                >
                  {luogoRilascioEstero ? "Rilasciato in Italia" : "Rilasciato all'estero"}
                </button>
              </div>
              <ComboboxSearch
                label=""
                placeholder={luogoRilascioEstero ? "Cerca stato..." : "Cerca comune..."}
                value={luogoRilascio}
                displayValue={luogoRilascioDisplay}
                onSearch={luogoRilascioEstero ? searchStatiCb : searchComuniCb}
                onSelect={setLuogoRilascio}
                error={errors.luogo_rilascio}
              />
            </div>
          </div>
        </div>

        {/* Azioni */}
        <div className="flex justify-end">
          <Button onClick={handleSubmit}>
            Prosegui <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
