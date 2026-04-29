"use client"

import { useState, useMemo, useCallback } from "react"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@ui/command"
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Plus, Trash2 } from "lucide-react"
import { cn } from "@/src/packages/utils"
import {
  searchComuni,
  searchStati,
  getComuneByCodice,
  getStatoByCodice,
} from "@alloggiati/codes"
import { CODICE_ITALIA, SESSO, TIPO_ALLOGGIATO } from "@alloggiati/types"

// ── Types ────────────────────────────────────

export type AccompagnatoreData = {
  guest_id?: string
  cognome: string
  nome: string
  sesso: "1" | "2"
  data_nascita: string            // gg/mm/aaaa
  stato_nascita: string           // codice 9 cifre
  comune_nascita?: string         // codice ISTAT 9 cifre
  provincia_nascita?: string      // sigla 2 chars
  cittadinanza: string            // codice 9 cifre
  guest_type: string              // "19" (familiare) o "20" (membro gruppo)
}

type Props = {
  accompagnatori: AccompagnatoreData[]
  onChange: (list: AccompagnatoreData[]) => void
  onNext: () => void
  onBack: () => void
}

// ── Helpers ──────────────────────────────────

function itDateToIso(itDate: string): string {
  const match = itDate.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!match) return ""
  return `${match[3]}-${match[2]}-${match[1]}`
}

// ── Combobox (simplified reuse) ──────────────

function ComboboxSearch({
  placeholder,
  value,
  displayValue,
  onSearch,
  onSelect,
}: {
  placeholder: string
  value: string
  displayValue: string
  onSearch: (q: string) => { value: string; label: string; sub?: string }[]
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const results = useMemo(() => {
    if (query.length < 2) return []
    return onSearch(query)
  }, [query, onSearch])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
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
          <CommandInput placeholder="Cerca..." value={query} onValueChange={setQuery} />
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
                    <Check className={cn("mr-2 h-4 w-4", value === item.value ? "opacity-100" : "opacity-0")} />
                    <span>{item.label}</span>
                    {item.sub && <span className="ml-1 text-xs text-muted-foreground">({item.sub})</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ── Single Accompagnatore Form ───────────────

function AccompagnatoreForm({
  data,
  index,
  onUpdate,
  onRemove,
}: {
  data: AccompagnatoreData
  index: number
  onUpdate: (updated: AccompagnatoreData) => void
  onRemove: () => void
}) {
  const isItalia = data.stato_nascita === CODICE_ITALIA

  const searchComuniCb = useCallback((q: string) => {
    return searchComuni(q, 15).map((c) => ({ value: c.c, label: c.n, sub: c.p }))
  }, [])

  const searchStatiCb = useCallback((q: string) => {
    return searchStati(q, 15).map((s) => ({ value: s.c, label: s.n }))
  }, [])

  const statoDisplay = useMemo(() => {
    if (!data.stato_nascita) return ""
    return getStatoByCodice(data.stato_nascita)?.n || data.stato_nascita
  }, [data.stato_nascita])

  const comuneDisplay = useMemo(() => {
    if (!data.comune_nascita) return ""
    const c = getComuneByCodice(data.comune_nascita)
    return c ? `${c.n} (${c.p})` : data.comune_nascita
  }, [data.comune_nascita])

  const cittadinanzaDisplay = useMemo(() => {
    if (!data.cittadinanza) return ""
    return getStatoByCodice(data.cittadinanza)?.n || data.cittadinanza
  }, [data.cittadinanza])

  function update(fields: Partial<AccompagnatoreData>) {
    onUpdate({ ...data, ...fields })
  }

  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Accompagnatore {index + 1}</h4>
        <Button variant="ghost" size="icon-sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Cognome */}
        <div className="space-y-1">
          <Label className="text-xs">Cognome *</Label>
          <Input
            value={data.cognome}
            onChange={(e) => update({ cognome: e.target.value })}
            maxLength={50}
            placeholder="Cognome"
          />
        </div>

        {/* Nome */}
        <div className="space-y-1">
          <Label className="text-xs">Nome *</Label>
          <Input
            value={data.nome}
            onChange={(e) => update({ nome: e.target.value })}
            maxLength={30}
            placeholder="Nome"
          />
        </div>

        {/* Sesso */}
        <div className="space-y-1">
          <Label className="text-xs">Sesso *</Label>
          <Select value={data.sesso || ""} onValueChange={(v) => update({ sesso: v as "1" | "2" })}>
            <SelectTrigger>
              <SelectValue placeholder="Sel..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SESSO.M}>Maschio</SelectItem>
              <SelectItem value={SESSO.F}>Femmina</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Data nascita */}
        <div className="space-y-1">
          <Label className="text-xs">Data nascita *</Label>
          <Input
            type="date"
            value={itDateToIso(data.data_nascita)}
            onChange={(e) => {
              const val = e.target.value
              if (val) {
                const [y, m, d] = val.split("-")
                update({ data_nascita: `${d}/${m}/${y}` })
              } else {
                update({ data_nascita: "" })
              }
            }}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Stato nascita */}
        <div className="space-y-1">
          <Label className="text-xs">Stato nascita *</Label>
          <ComboboxSearch
            placeholder="Cerca stato..."
            value={data.stato_nascita}
            displayValue={statoDisplay}
            onSearch={searchStatiCb}
            onSelect={(code) => {
              update({
                stato_nascita: code,
                comune_nascita: code !== CODICE_ITALIA ? "" : data.comune_nascita,
                provincia_nascita: code !== CODICE_ITALIA ? "" : data.provincia_nascita,
              })
            }}
          />
        </div>

        {/* Comune nascita (se Italia) */}
        {isItalia && (
          <div className="space-y-1">
            <Label className="text-xs">Comune nascita *</Label>
            <ComboboxSearch
              placeholder="Cerca comune..."
              value={data.comune_nascita || ""}
              displayValue={comuneDisplay}
              onSearch={searchComuniCb}
              onSelect={(code) => {
                const c = getComuneByCodice(code)
                update({
                  comune_nascita: code,
                  provincia_nascita: c?.p || "",
                })
              }}
            />
          </div>
        )}

        {/* Cittadinanza */}
        <div className="space-y-1">
          <Label className="text-xs">Cittadinanza *</Label>
          <ComboboxSearch
            placeholder="Cerca stato..."
            value={data.cittadinanza}
            displayValue={cittadinanzaDisplay}
            onSearch={searchStatiCb}
            onSelect={(code) => update({ cittadinanza: code })}
          />
        </div>
      </div>

      {/* Tipo accompagnatore */}
      <div className="max-w-xs space-y-1">
        <Label className="text-xs">Tipo</Label>
        <Select value={data.guest_type} onValueChange={(v) => update({ guest_type: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TIPO_ALLOGGIATO.FAMILIARE}>Familiare</SelectItem>
            <SelectItem value={TIPO_ALLOGGIATO.MEMBRO_GRUPPO}>Membro gruppo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}

// ── Main Component ───────────────────────────

export function AccompagnatoriList({ accompagnatori, onChange, onNext, onBack }: Props) {
  function addAccompagnatore() {
    onChange([
      ...accompagnatori,
      {
        cognome: "",
        nome: "",
        sesso: "" as "1" | "2",
        data_nascita: "",
        stato_nascita: "",
        comune_nascita: "",
        provincia_nascita: "",
        cittadinanza: "",
        guest_type: TIPO_ALLOGGIATO.FAMILIARE,
      },
    ])
  }

  function updateAt(index: number, updated: AccompagnatoreData) {
    const next = [...accompagnatori]
    next[index] = updated
    onChange(next)
  }

  function removeAt(index: number) {
    onChange(accompagnatori.filter((_, i) => i !== index))
  }

  function validateAll(): boolean {
    for (const a of accompagnatori) {
      if (!a.cognome.trim() || !a.nome.trim() || !a.sesso || !a.data_nascita || !a.stato_nascita || !a.cittadinanza) {
        return false
      }
      if (a.stato_nascita === CODICE_ITALIA && !a.comune_nascita) {
        return false
      }
    }
    return true
  }

  function handleNext() {
    if (accompagnatori.length > 0 && !validateAll()) {
      // Highlight che ci sono campi mancanti senza toast (visuale)
      return
    }
    onNext()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Accompagnatori</CardTitle>
          <Button variant="outline" size="sm" onClick={addAccompagnatore}>
            <Plus className="mr-1 h-4 w-4" /> Aggiungi
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {accompagnatori.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nessun accompagnatore. Se l&apos;ospite viaggia da solo, prosegui al passo successivo.
          </div>
        ) : (
          accompagnatori.map((acc, i) => (
            <AccompagnatoreForm
              key={i}
              data={acc}
              index={i}
              onUpdate={(updated) => updateAt(i, updated)}
              onRemove={() => removeAt(i)}
            />
          ))
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="mr-1 h-4 w-4" /> Indietro
          </Button>
          <Button onClick={handleNext}>
            Prosegui <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
