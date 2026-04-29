"use client"

import { useRouter } from "next/navigation"
import { Badge } from "@ui/badge"
import { Button } from "@ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/select"
import {
  Landmark, Euro, Users, CalendarDays, FileWarning,
  CheckCircle2, Settings, ExternalLink, Copy,
  ArrowRight, FileText, CreditCard, Send,
} from "lucide-react"
import Link from "next/link"
import { ExportButtons } from "@export/export-buttons"
import type { ExportColumn } from "@export/download-helpers"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

type ReportItem = {
  id: string
  description: string
  quantity: number
  unit_price: number
  total_gross: number | null
  date: string | null
  folio: {
    id: string
    booking: {
      id: string
      booking_number: string
      check_in: string
      check_out: string
      nights: number
      adults: number
      children: number
      status: string
      guest: { full_name: string } | null
      channel: { name: string } | null
    } | null
  } | null
}

type Summary = {
  totalCollected: number
  totalBookings: number
  totalTaxablePersonNights: number
  month: string
}

type Config = {
  tourist_tax_enabled: boolean
  tourist_tax_rate: number
  tourist_tax_max_nights: number
  tourist_tax_child_exempt_age: number
  tourist_tax_exempt_residents: boolean
  tourist_tax_exempt_ota_channels: string[]
  tourist_tax_municipality: string | null
  tourist_tax_catastale_code?: string | null
} | undefined

type Props = {
  month: string
  report: { items: ReportItem[]; summary: Summary } | null
  error?: string
  config?: Config
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EXPORT_COLUMNS: ExportColumn[] = [
  { header: "Data",             key: "date",           width: 12 },
  { header: "N. Prenotazione",  key: "booking_number", width: 16 },
  { header: "Ospite",           key: "guest_name",     width: 22 },
  { header: "Check-in",         key: "check_in",       width: 12 },
  { header: "Check-out",        key: "check_out",      width: 12 },
  { header: "Notti",            key: "nights",         width: 8  },
  { header: "Ospiti tassabili", key: "taxable_guests", width: 14 },
  { header: "Tariffa (€)",      key: "rate",           width: 10 },
  { header: "Totale (€)",       key: "total",          width: 10 },
  { header: "Canale",           key: "channel",        width: 16 },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMonthOptions() {
  const options: { value: string; label: string }[] = []
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("it-IT", { month: "long", year: "numeric" })
    options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
  }
  return options
}

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d + "T00:00:00").toLocaleDateString("it-IT", {
    day: "2-digit", month: "2-digit", year: "numeric",
  })
}

function getDeadline(month: string) {
  const [y, m] = month.split("-").map(Number)
  const next = new Date(y, m, 15) // 15th of next month
  return next.toLocaleDateString("it-IT", { day: "2-digit", month: "long", year: "numeric" })
}

function getYear(month: string) {
  return month.split("-")[0]
}

// ─── Copy helper ──────────────────────────────────────────────────────────────

function CopyField({ label, value }: { label: string; value: string }) {
  function handleCopy() {
    navigator.clipboard.writeText(value)
    toast.success(`"${label}" copiato`)
  }
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-border last:border-0">
      <div>
        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
      </div>
      <button
        onClick={handleCopy}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        title="Copia"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TaxReportClient({ month, report, error, config }: Props) {
  const router = useRouter()
  const monthOptions = getMonthOptions()
  const currentMonthLabel = monthOptions.find(o => o.value === month)?.label ?? month

  // ── Non configurata ────────────────────────────────────────────────────────
  if (!config || !config.tourist_tax_enabled) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
          <FileWarning className="h-8 w-8 text-amber-500" />
        </div>
        <h2 className="text-lg font-bold text-foreground mb-2">Tassa di soggiorno non configurata</h2>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Prima di visualizzare il report, configura la tassa di soggiorno (tariffa, esenzioni, max notti) nelle impostazioni.
        </p>
        <Link href="/settings?tab=tassa-soggiorno">
          <Button>
            <Settings className="mr-2 h-4 w-4" />
            Vai alle impostazioni
          </Button>
        </Link>
      </div>
    )
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  const summary   = report?.summary
  const items     = report?.items ?? []
  const catastale = config.tourist_tax_catastale_code?.trim() || "I862" // default Sorrento
  const tourTaxUrl = `https://tourtaxmain.servizienti.it/TourTaxFO/?c=${catastale}`
  const deadline  = getDeadline(month)
  const year      = getYear(month)
  const totalStr  = (summary?.totalCollected ?? 0).toFixed(2)

  const exportData = items.map((item) => {
    const b = item.folio?.booking
    const taxableGuests = b?.nights ? Math.round(item.quantity / b.nights) : item.quantity
    return {
      date:           formatDate(item.date),
      booking_number: b?.booking_number ?? "—",
      guest_name:     b?.guest?.full_name ?? "—",
      check_in:       formatDate(b?.check_in ?? null),
      check_out:      formatDate(b?.check_out ?? null),
      nights:         b?.nights ?? 0,
      taxable_guests: taxableGuests,
      rate:           Number(item.unit_price).toFixed(2),
      total:          Number(item.total_gross ?? 0).toFixed(2),
      channel:        b?.channel?.name ?? "Diretto",
    }
  })

  return (
    <div className="space-y-6">

      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={month} onValueChange={(v) => router.push(`/tassa-soggiorno?month=${v}`)}>
          <SelectTrigger className="w-[220px] h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {monthOptions.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 h-9 px-3">
          <CheckCircle2 className="mr-1.5 h-3 w-3" /> Attiva
        </Badge>
        <Badge variant="outline" className="h-9 px-3">
          €{config.tourist_tax_rate}/pers/notte
        </Badge>
        <Badge variant="outline" className="h-9 px-3">
          Max {config.tourist_tax_max_nights} notti
        </Badge>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/settings?tab=tassa-soggiorno">
            <Button variant="outline" size="sm">
              <Settings className="h-3.5 w-3.5 mr-1.5" />
              Impostazioni
            </Button>
          </Link>
          <ExportButtons
            data={exportData}
            columns={EXPORT_COLUMNS}
            filename={`tassa-soggiorno-${month}`}
            title={`Tassa di Soggiorno — ${currentMonthLabel}`}
            sheetName="Tassa Soggiorno"
          />
        </div>
      </div>

      {/* ── KPI cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200/60 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 mb-3">
            <Euro className="h-3.5 w-3.5" />
            Da versare al Comune
          </div>
          <p className="text-3xl font-black text-emerald-800">€{totalStr}</p>
          <p className="text-xs text-emerald-600/80 mt-1">Entro il {deadline}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
            <Landmark className="h-3.5 w-3.5" />
            Prenotazioni
          </div>
          <p className="text-3xl font-black text-foreground">{summary?.totalBookings ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Con tassa applicata</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
            <Users className="h-3.5 w-3.5" />
            Persone × notti
          </div>
          <p className="text-3xl font-black text-foreground">{summary?.totalTaxablePersonNights ?? 0}</p>
          <p className="text-xs text-muted-foreground mt-1">Ospiti tassabili totali</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-3">
            <CalendarDays className="h-3.5 w-3.5" />
            Scadenza versamento
          </div>
          <p className="text-lg font-black text-foreground leading-tight">{deadline}</p>
          <p className="text-xs text-muted-foreground mt-1">15° giorno del mese successivo</p>
        </div>
      </div>

      {/* ── Layout a 2 colonne: tabella + F24 guide ──────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Tabella dettaglio */}
        <div className="xl:col-span-2 rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Dettaglio {currentMonthLabel}</h2>
            <span className="text-xs text-muted-foreground">{items.length} voci</span>
          </div>

          {items.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nessun dato</p>
              <p className="text-xs text-muted-foreground mt-1">
                Nessuna tassa di soggiorno registrata in {currentMonthLabel.toLowerCase()}.
                La tassa viene applicata automaticamente al check-in.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Data</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Prenotazione</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Ospite</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Canale</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Notti</th>
                    <th className="px-4 py-3 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Ospiti</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Importo</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const b = item.folio?.booking
                    const taxableGuests = b?.nights ? Math.round(item.quantity / b.nights) : item.quantity
                    return (
                      <tr key={item.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(item.date)}</td>
                        <td className="px-4 py-3">
                          {b ? (
                            <Link href={`/bookings/${b.id}`} className="font-semibold text-primary hover:underline text-xs">
                              {b.booking_number}
                            </Link>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{b?.guest?.full_name ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-muted-foreground">{b?.channel?.name ?? "Diretto"}</span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm">{b?.nights ?? "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                            <Users className="h-3 w-3" />{taxableGuests}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-700">
                          €{Number(item.total_gross ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-emerald-50 border-t border-emerald-200">
                    <td className="px-4 py-3 text-sm font-bold text-emerald-800" colSpan={6}>
                      Totale {currentMonthLabel}
                    </td>
                    <td className="px-4 py-3 text-right text-base font-black text-emerald-800">
                      €{totalStr}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Colonna destra: F24 + Guida */}
        <div className="space-y-4">

          {/* F24 card */}
          <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-blue-50/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                  <CreditCard className="h-3.5 w-3.5 text-blue-700" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Dati F24 per il versamento</h3>
              </div>
            </div>
            <div className="px-5 py-4 space-y-0">
              <CopyField label="Codice Tributo" value="3936" />
              <CopyField label="Codice Ente (catastale)" value={catastale} />
              {config.tourist_tax_municipality && (
                <CopyField label="Comune" value={config.tourist_tax_municipality} />
              )}
              <CopyField label="Tariffa / persona / notte" value={`€ ${Number(config.tourist_tax_rate).toFixed(2)}`} />
              <CopyField label="Max notti tassabili" value={String(config.tourist_tax_max_nights)} />
              <CopyField label="Esenti sotto i" value={`${config.tourist_tax_child_exempt_age} anni`} />
              <CopyField label="Anno di riferimento" value={year} />
              <CopyField label="Importo da versare" value={`€ ${totalStr}`} />
            </div>
            <div className="px-5 py-3 bg-amber-50 border-t border-amber-100">
              <p className="text-[11px] text-amber-700 font-medium">
                ⚠️ Scadenza: <strong>entro il 15/{String(parseInt(month.split("-")[1]) + 1).padStart(2, "0")}/{year}</strong>
              </p>
            </div>
          </div>

          {/* TourTax portal */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center">
                <Send className="h-3.5 w-3.5 text-slate-600" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Portale TourTax Comune</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              Accedi al portale del Comune per effettuare la dichiarazione mensile. Dopo aver inviato la dichiarazione, il sistema genera il modello F24 precompilato.
            </p>
            <a href={tourTaxUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
              <Button variant="outline" className="w-full gap-2 text-sm">
                <ExternalLink className="h-3.5 w-3.5" />
                Apri portale TourTax
              </Button>
            </a>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              Supporto: <strong>081.8427167</strong> (lun–ven 9–13 / 14–18)
            </p>
          </div>

          {/* Guida step-by-step */}
          <div className="rounded-2xl border border-border bg-card shadow-sm p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">Procedura mensile</h3>
            <ol className="space-y-3">
              {[
                {
                  step: "1",
                  title: "Raccogli la tassa",
                  desc: "Il gestionale la applica automaticamente al check-in. Verificala nel folio di ogni prenotazione.",
                  color: "bg-blue-500",
                },
                {
                  step: "2",
                  title: "Scarica il report",
                  desc: "Usa il tasto Export per scaricare il dettaglio del mese in Excel o PDF.",
                  color: "bg-indigo-500",
                },
                {
                  step: "3",
                  title: "Dichiara sul portale",
                  desc: "Accedi a TourTax, crea la dichiarazione mensile inserendo il totale raccolta.",
                  color: "bg-purple-500",
                },
                {
                  step: "4",
                  title: "Paga con F24",
                  desc: `Usa i dati qui a fianco. Scadenza: 15° giorno del mese successivo.`,
                  color: "bg-emerald-500",
                },
              ].map(({ step, title, desc, color }) => (
                <li key={step} className="flex gap-3">
                  <div className={`w-6 h-6 rounded-full ${color} flex items-center justify-center shrink-0 mt-0.5`}>
                    <span className="text-white text-[10px] font-black">{step}</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">{title}</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Regole esenzione */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5">
            <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-3">Esenzioni configurate</h3>
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-xs text-amber-900">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                Bambini sotto i <strong>{config.tourist_tax_child_exempt_age} anni</strong> — esenti
              </li>
              {config.tourist_tax_exempt_residents && (
                <li className="flex items-center gap-2 text-xs text-amber-900">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  Residenti a <strong>{config.tourist_tax_municipality || "—"}</strong> — esenti
                </li>
              )}
              <li className="flex items-center gap-2 text-xs text-amber-900">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                Massimo <strong>{config.tourist_tax_max_nights} notti</strong> tassabili per soggiorno
              </li>
            </ul>
            <Link href="/settings?tab=tassa-soggiorno" className="flex items-center gap-1 text-[11px] text-amber-700 font-semibold mt-3 hover:text-amber-900">
              Modifica nelle impostazioni <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

        </div>
      </div>

    </div>
  )
}
