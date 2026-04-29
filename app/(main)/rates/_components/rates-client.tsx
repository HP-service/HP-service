"use client"
// v3 — Prezzario Dinamico migliorato con guide utente e template stagionali
import { useState, useTransition, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import {
  ChevronLeft, ChevronRight, Check, X, Lock, Unlock,
  Pencil, Euro, CalendarCheck, CalendarX, Info, Zap,
  Sun, Snowflake, Leaf, Cloud, HelpCircle,
} from "lucide-react"
import {
  upsertDailyRate, upsertDailyRatesBulk,
  setDatesClosed, setBulkPrice,
} from "@db/queries/rates"

// ─── Types ────────────────────────────────────────────────────────────────────

type RoomType = {
  id: string
  name: string
  short_code: string | null
  base_price: number | null
}

type DailyRate = {
  room_type_id: string
  date: string
  price: number | null
  is_closed: boolean | null
}

type Props = {
  roomTypes: RoomType[]
  dailyRates: DailyRate[]
  occupancyMap: Record<string, Record<string, number>>
  roomCounts: Record<string, number>
  today: string
}

// ─── Seasonal Templates ───────────────────────────────────────────────────────

type SeasonTemplate = {
  id: string
  name: string
  icon: React.ReactNode
  color: string
  bgColor: string
  description: string
  multiplier: number
  weekendExtra: number // percentuale extra weekend
}

const SEASON_TEMPLATES: SeasonTemplate[] = [
  {
    id: "alta",
    name: "Alta Stagione",
    icon: <Sun className="h-4 w-4" />,
    color: "text-orange-600",
    bgColor: "bg-orange-50 border-orange-200 hover:bg-orange-100",
    description: "Luglio, Agosto, festività. Prezzo +40% rispetto alla base, weekend +20% extra",
    multiplier: 1.4,
    weekendExtra: 0.2,
  },
  {
    id: "media",
    name: "Media Stagione",
    icon: <Leaf className="h-4 w-4" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
    description: "Aprile-Giugno, Settembre-Ottobre. Prezzo +15%, weekend +10% extra",
    multiplier: 1.15,
    weekendExtra: 0.1,
  },
  {
    id: "bassa",
    name: "Bassa Stagione",
    icon: <Snowflake className="h-4 w-4" />,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200 hover:bg-blue-100",
    description: "Novembre-Marzo. Prezzo base, nessun extra weekend",
    multiplier: 1.0,
    weekendExtra: 0,
  },
  {
    id: "promo",
    name: "Promozione",
    icon: <Zap className="h-4 w-4" />,
    color: "text-purple-600",
    bgColor: "bg-purple-50 border-purple-200 hover:bg-purple-100",
    description: "Sconto -15% per riempire periodi vuoti. Ideale per last minute",
    multiplier: 0.85,
    weekendExtra: 0,
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = []
  const d = new Date(Date.UTC(year, month, 1))
  while (d.getUTCMonth() === month) {
    days.push(d.toISOString().split("T")[0])
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
}

function fmtMonthYear(year: number, month: number) {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  })
}

function fmtDate(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00")
  return {
    day: d.toLocaleDateString("it-IT", { day: "2-digit" }),
    dow: d.toLocaleDateString("it-IT", { weekday: "short" }).slice(0, 3),
    isWeekend: d.getDay() === 0 || d.getDay() === 6,
  }
}

function occColor(pct: number): string {
  if (pct >= 90) return "bg-red-500"
  if (pct >= 60) return "bg-orange-400"
  if (pct >= 30) return "bg-yellow-400"
  return "bg-emerald-400"
}

// ─── Tooltip Component ────────────────────────────────────────────────────────

function Tip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help">
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-blue-500 transition-colors" />
      <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 text-[11px] text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap z-50 max-w-[250px] text-wrap leading-tight">
        {text}
      </span>
    </span>
  )
}

// ─── Inline Price Editor ──────────────────────────────────────────────────────

function PriceCell({
  price,
  basePrice,
  date,
  roomTypeId,
  isClosed,
  onSaved,
}: {
  price: number | null
  basePrice: number | null
  date: string
  roomTypeId: string
  isClosed: boolean
  onSaved: (date: string, update: { price?: number; is_closed?: boolean }) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState("")
  const [isPending, start] = useTransition()
  const router = useRouter()

  const displayPrice = price ?? basePrice

  function startEdit() {
    setVal(displayPrice !== null ? String(Math.round(displayPrice)) : "")
    setEditing(true)
  }

  function handleSave() {
    const n = parseFloat(val)
    if (isNaN(n) || n <= 0) { toast.error("Prezzo non valido"); return }
    start(async () => {
      const r = await upsertDailyRate(roomTypeId, date, n)
      if (r.error) { toast.error(r.error); return }
      onSaved(date, { price: n })
      setEditing(false)
      router.refresh()
    })
  }

  function toggleClosed() {
    start(async () => {
      const r = await setDatesClosed(roomTypeId, [date], !isClosed)
      if (r.error) { toast.error(r.error); return }
      onSaved(date, { is_closed: !isClosed })
      toast.success(isClosed ? "Giorno riaperto alle vendite" : "Giorno chiuso alle vendite")
      router.refresh()
    })
  }

  if (isClosed) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <span className="text-xs text-muted-foreground/50 line-through">
          {displayPrice !== null ? `€${Math.round(displayPrice)}` : "—"}
        </span>
        <span className="text-[10px] font-medium text-red-400 uppercase tracking-wide">chiuso</span>
        <button
          onClick={toggleClosed}
          disabled={isPending}
          className="mt-0.5 flex items-center gap-0.5 text-[10px] text-muted-foreground/60 hover:text-emerald-600 transition-colors"
          title="Clicca per riaprire questo giorno alle vendite"
        >
          <Unlock className="h-3 w-3" />
        </button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex flex-col items-center gap-1 py-1">
        <div className="flex items-center gap-0.5">
          <Input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") setEditing(false)
            }}
            className="h-6 w-14 text-xs text-center p-1"
            autoFocus
            disabled={isPending}
          />
        </div>
        <div className="flex gap-1">
          <button onClick={handleSave} disabled={isPending} className="text-emerald-600 hover:text-emerald-700">
            <Check className="h-3 w-3" />
          </button>
          <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-red-400">
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-1 py-1 group">
      <button
        onClick={startEdit}
        className="flex items-center gap-0.5 text-sm font-semibold text-foreground hover:text-blue-600 transition-colors"
        title="Clicca per modificare il prezzo di questo giorno"
      >
        {displayPrice !== null ? `€${Math.round(displayPrice)}` : (
          <span className="text-muted-foreground/40 font-normal text-xs">base</span>
        )}
        <Pencil className="h-2.5 w-2.5 opacity-0 group-hover:opacity-60 transition-opacity" />
      </button>
      <button
        onClick={toggleClosed}
        disabled={isPending}
        className="text-muted-foreground/30 hover:text-red-400 transition-colors"
        title="Clicca per chiudere questo giorno alle vendite"
      >
        <Lock className="h-3 w-3" />
      </button>
    </div>
  )
}

// ─── Bulk Action Panel ────────────────────────────────────────────────────────

function BulkPanel({
  roomTypeId,
  today,
  basePrice,
  onApplied,
}: {
  roomTypeId: string
  today: string
  basePrice: number | null
  onApplied: () => void
}) {
  const router = useRouter()
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [price, setPrice] = useState("")
  const [isPending, start] = useTransition()
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)

  function getDatesInRange(): string[] {
    const dates: string[] = []
    const cur = new Date(from + "T00:00:00Z")
    const end = new Date(to + "T00:00:00Z")
    while (cur <= end) {
      dates.push(cur.toISOString().split("T")[0])
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    return dates
  }

  function handleSetPrice() {
    const n = parseFloat(price)
    if (isNaN(n) || n <= 0) { toast.error("Inserisci un prezzo valido"); return }
    const dates = getDatesInRange()
    if (dates.length === 0) return
    start(async () => {
      const r = await setBulkPrice(roomTypeId, dates, n)
      if (r.error) { toast.error(r.error); return }
      toast.success(`Prezzo €${Math.round(n)} impostato per ${dates.length} giorni`)
      onApplied()
      router.refresh()
    })
  }

  function handleClose(isClosed: boolean) {
    const dates = getDatesInRange()
    if (dates.length === 0) return
    start(async () => {
      const r = await setDatesClosed(roomTypeId, dates, isClosed)
      if (r.error) { toast.error(r.error); return }
      toast.success(`${dates.length} giorni ${isClosed ? "chiusi" : "aperti"}`)
      onApplied()
      router.refresh()
    })
  }

  function handleApplyTemplate(template: SeasonTemplate) {
    if (!basePrice || basePrice <= 0) {
      toast.error("Imposta prima un prezzo base nella sezione Tipi Camera delle Impostazioni")
      return
    }
    const dates = getDatesInRange()
    if (dates.length === 0) { toast.error("Seleziona un intervallo di date"); return }

    start(async () => {
      // Calcola prezzi diversi per feriali e weekend
      const rows = dates.map((d) => {
        const dayOfWeek = new Date(d + "T00:00:00").getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
        let p = Math.round(basePrice * template.multiplier)
        if (isWeekend && template.weekendExtra > 0) {
          p = Math.round(p * (1 + template.weekendExtra))
        }
        return { room_type_id: roomTypeId, date: d, price: p }
      })

      const r = await upsertDailyRatesBulk(rows)
      if (r.error) { toast.error(r.error); return }

      const feriali = rows.filter((_, i) => {
        const dayOfWeek = new Date(dates[i] + "T00:00:00").getDay()
        return dayOfWeek !== 0 && dayOfWeek !== 6
      })
      const weekend = rows.filter((_, i) => {
        const dayOfWeek = new Date(dates[i] + "T00:00:00").getDay()
        return dayOfWeek === 0 || dayOfWeek === 6
      })

      let msg = `${template.name} applicata: ${dates.length} giorni`
      if (feriali.length > 0) msg += ` — Feriali €${feriali[0].price}`
      if (weekend.length > 0) msg += `, Weekend €${weekend[0].price}`

      toast.success(msg)
      setSelectedTemplate(null)
      onApplied()
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      {/* Template stagionali */}
      <Card className="border-blue-200/50 bg-blue-50/20">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-blue-900">Template Rapidi</p>
            <Tip text="Seleziona un periodo e applica un template stagionale. I prezzi vengono calcolati automaticamente dal prezzo base del tipo camera. I weekend hanno un extra automatico." />
          </div>

          {/* Date range */}
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                Dal
                <Tip text="Data di inizio del periodo a cui vuoi applicare il template" />
              </p>
              <Input
                type="date"
                value={from}
                min={today}
                onChange={(e) => setFrom(e.target.value)}
                className="h-8 text-xs w-36 bg-white"
              />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                Al
                <Tip text="Data di fine del periodo" />
              </p>
              <Input
                type="date"
                value={to}
                min={from}
                onChange={(e) => setTo(e.target.value)}
                className="h-8 text-xs w-36 bg-white"
              />
            </div>
            {from && to && from <= to && (
              <span className="text-xs text-blue-600 font-medium pb-1.5">
                {getDatesInRange().length} giorni selezionati
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {SEASON_TEMPLATES.map((t) => {
              const calculatedPrice = basePrice ? Math.round(basePrice * t.multiplier) : null
              const weekendPrice = basePrice && t.weekendExtra > 0
                ? Math.round(basePrice * t.multiplier * (1 + t.weekendExtra))
                : null

              return (
                <button
                  key={t.id}
                  onClick={() => handleApplyTemplate(t)}
                  disabled={isPending}
                  className={`flex flex-col gap-1.5 p-3 rounded-xl border text-left transition-all ${t.bgColor} ${
                    selectedTemplate === t.id ? "ring-2 ring-offset-1" : ""
                  }`}
                >
                  <div className={`flex items-center gap-1.5 font-semibold text-sm ${t.color}`}>
                    {t.icon}
                    {t.name}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-tight">
                    {t.description}
                  </p>
                  {calculatedPrice && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-bold">
                        Feriale: €{calculatedPrice}
                      </span>
                      {weekendPrice && (
                        <span className="text-xs font-bold text-orange-600">
                          Weekend: €{weekendPrice}
                        </span>
                      )}
                    </div>
                  )}
                  {!calculatedPrice && (
                    <span className="text-[10px] text-red-500 mt-1">
                      ⚠️ Imposta prezzo base in Impostazioni
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Azioni manuali */}
      <Card className="border-dashed">
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Modifica Manuale</p>
            <Tip text="Per un controllo totale: imposta un prezzo specifico o chiudi/apri date manualmente" />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex items-center gap-2">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Dal</p>
                <Input
                  type="date"
                  value={from}
                  min={today}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-7 text-xs w-32"
                />
              </div>
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Al</p>
                <Input
                  type="date"
                  value={to}
                  min={from}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-7 text-xs w-32"
                />
              </div>
            </div>

            <div className="flex items-end gap-2">
              <div className="space-y-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                  Prezzo
                  <Tip text="Inserisci il prezzo per notte che vuoi impostare per tutto il periodo" />
                </p>
                <div className="flex items-center gap-1">
                  <Euro className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="es. 120"
                    className="h-7 text-xs w-20"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleSetPrice}
                disabled={isPending || !price}
                className="h-7 text-xs"
              >
                <CalendarCheck className="h-3.5 w-3.5 mr-1" />
                Imposta prezzo
              </Button>
            </div>

            <div className="flex items-end gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleClose(true)}
                disabled={isPending}
                className="h-7 text-xs border-red-200 text-red-600 hover:bg-red-50"
              >
                <CalendarX className="h-3.5 w-3.5 mr-1" />
                Chiudi date
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isPending}
                className="h-7 text-xs border-emerald-200 text-emerald-600 hover:bg-emerald-50"
              >
                <CalendarCheck className="h-3.5 w-3.5 mr-1" />
                Apri date
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RatesClient({ roomTypes, dailyRates, occupancyMap, roomCounts, today }: Props) {
  const [selectedRT, setSelectedRT] = useState(roomTypes[0]?.id ?? "")
  const [viewYear, setViewYear] = useState(() => new Date(today).getFullYear())
  const [viewMonth, setViewMonth] = useState(() => new Date(today).getMonth())
  const [showGuide, setShowGuide] = useState(false)

  // Local overrides for optimistic updates
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, { price?: number | null; is_closed?: boolean }>
  >({})

  const rt = roomTypes.find((r) => r.id === selectedRT)

  // Build rate map from server data + local overrides
  const rateMap = useMemo(() => {
    const m: Record<string, { price: number | null; is_closed: boolean }> = {}
    for (const dr of dailyRates) {
      if (dr.room_type_id === selectedRT) {
        m[dr.date] = {
          price: dr.price,
          is_closed: dr.is_closed ?? false,
        }
      }
    }
    // Apply local overrides
    for (const [date, override] of Object.entries(localOverrides)) {
      if (!m[date]) m[date] = { price: null, is_closed: false }
      if (override.price !== undefined) m[date].price = override.price
      if (override.is_closed !== undefined) m[date].is_closed = override.is_closed
    }
    return m
  }, [dailyRates, selectedRT, localOverrides])

  const days = useMemo(
    () => getDaysInMonth(viewYear, viewMonth),
    [viewYear, viewMonth]
  )

  const totalRooms = roomCounts[selectedRT] ?? 0
  const occForRT = occupancyMap[selectedRT] ?? {}

  function handlePrevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function handleNextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const handleCellSaved = useCallback(
    (date: string, update: { price?: number; is_closed?: boolean }) => {
      setLocalOverrides((prev) => ({
        ...prev,
        [date]: { ...prev[date], ...update },
      }))
    },
    []
  )

  // Stats for the current month view
  const monthStats = useMemo(() => {
    const futureDays = days.filter((d) => d >= today)
    const closedDays = futureDays.filter((d) => rateMap[d]?.is_closed)
    const prices = futureDays
      .filter((d) => !rateMap[d]?.is_closed && rateMap[d]?.price != null)
      .map((d) => rateMap[d]?.price)
      .filter((p): p is number => p != null)
    const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : null
    const minPrice = prices.length > 0 ? Math.min(...prices) : null
    const maxPrice = prices.length > 0 ? Math.max(...prices) : null
    const avgOcc = futureDays.length > 0 && totalRooms > 0
      ? futureDays.reduce((sum, d) => sum + (occForRT[d] ?? 0), 0) / (futureDays.length * totalRooms) * 100
      : null

    return { closedDays: closedDays.length, avgPrice, minPrice, maxPrice, avgOcc, futureDays: futureDays.length }
  }, [days, today, rateMap, occForRT, totalRooms])

  return (
    <div className="space-y-5">
      {/* Header con guida */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Prezzario Dinamico</h1>
          <p className="text-sm text-muted-foreground">
            Imposta i prezzi per notte di ogni tipo camera
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5"
          onClick={() => setShowGuide(!showGuide)}
        >
          <Info className="h-3.5 w-3.5" />
          {showGuide ? "Nascondi guida" : "Come funziona?"}
        </Button>
      </div>

      {/* Guida utente espandibile */}
      {showGuide && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" />
              Guida al Prezzario
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-800">
              <div className="space-y-2">
                <p className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">1.</span>
                  <span><strong>Seleziona il tipo camera</strong> usando le tab in alto (es. Singola, Doppia, Suite)</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">2.</span>
                  <span><strong>Usa i Template Rapidi</strong> per impostare velocemente i prezzi stagionali. Seleziona il periodo e clicca sul template desiderato</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">3.</span>
                  <span><strong>Modifica singoli giorni</strong> cliccando sul prezzo nel calendario. Premi Invio per salvare</span>
                </p>
              </div>
              <div className="space-y-2">
                <p className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">4.</span>
                  <span><strong>Chiudi un giorno</strong> cliccando il lucchetto 🔒 sotto il prezzo. La camera non sarà prenotabile</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">5.</span>
                  <span><strong>I weekend</strong> (sab-dom) sono evidenziati in viola. I template applicano automaticamente un sovrapprezzo weekend</span>
                </p>
                <p className="flex items-start gap-2">
                  <span className="font-bold text-blue-600 shrink-0">💡</span>
                  <span>Il <strong>prezzo base</strong> si imposta in Impostazioni → Tipi Camera. I template lo usano come riferimento</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Room type tabs */}
      <div className="flex items-center gap-1 border rounded-xl p-1 bg-muted/30 w-fit overflow-x-auto">
        {roomTypes.map((r) => (
          <button
            key={r.id}
            onClick={() => { setSelectedRT(r.id); setLocalOverrides({}) }}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-all whitespace-nowrap ${
              r.id === selectedRT
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {r.short_code ?? r.name}
            {r.short_code && (
              <span className="ml-1.5 text-xs text-muted-foreground font-normal hidden sm:inline">
                {r.name}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Month stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Prezzo base
              <Tip text="Il prezzo di riferimento impostato nelle Impostazioni per questo tipo camera" />
            </p>
            <p className="text-xl font-bold mt-0.5">
              {rt?.base_price !== null && rt?.base_price !== undefined ? `€${rt.base_price}` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Prezzo medio mese
              <Tip text="Media dei prezzi impostati per i giorni futuri di questo mese" />
            </p>
            <p className="text-xl font-bold mt-0.5 text-blue-600">
              {monthStats.avgPrice !== null ? `€${Math.round(monthStats.avgPrice)}` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Range prezzi
              <Tip text="Prezzo minimo e massimo impostati per questo mese" />
            </p>
            <p className="text-xl font-bold mt-0.5">
              {monthStats.minPrice !== null && monthStats.maxPrice !== null
                ? `€${Math.round(monthStats.minPrice)}–€${Math.round(monthStats.maxPrice)}`
                : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Occ. media
              <Tip text="Percentuale media di occupazione delle camere di questo tipo per il mese" />
            </p>
            <p className={`text-xl font-bold mt-0.5 ${
              monthStats.avgOcc === null ? "" :
              monthStats.avgOcc >= 80 ? "text-red-500" :
              monthStats.avgOcc >= 50 ? "text-orange-500" : "text-emerald-600"
            }`}>
              {monthStats.avgOcc !== null ? `${Math.round(monthStats.avgOcc)}%` : "—"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-3 pb-3">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              Giorni chiusi
              <Tip text="Giorni in cui questo tipo camera non è prenotabile" />
            </p>
            <p className="text-xl font-bold mt-0.5 text-red-500">
              {monthStats.closedDays}
              <span className="text-sm text-muted-foreground font-normal ml-1">
                / {monthStats.futureDays}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk actions + Templates */}
      <BulkPanel
        roomTypeId={selectedRT}
        today={today}
        basePrice={rt?.base_price ?? null}
        onApplied={() => setLocalOverrides({})}
      />

      {/* Calendar grid */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              Calendario prezzi — {rt?.name}
              {totalRooms > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({totalRooms} {totalRooms === 1 ? "camera" : "camere"})
                </span>
              )}
              <Tip text="Clicca su un prezzo per modificarlo. Clicca sul lucchetto per chiudere/aprire un giorno. I giorni passati sono in grigio." />
            </CardTitle>
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevMonth}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium min-w-[130px] text-center capitalize">
                {fmtMonthYear(viewYear, viewMonth)}
              </span>
              <button
                onClick={handleNextMonth}
                className="p-1 rounded hover:bg-muted transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <colgroup>
                {days.map((d) => (
                  <col key={d} style={{ minWidth: "72px" }} />
                ))}
              </colgroup>
              <thead>
                <tr className="border-b bg-muted/20">
                  {days.map((date) => {
                    const { day, dow, isWeekend } = fmtDate(date)
                    const isPast = date < today
                    return (
                      <th
                        key={date}
                        className={`px-1 py-2 text-center text-xs font-medium border-r last:border-r-0 ${
                          isPast ? "text-muted-foreground/40" :
                          isWeekend ? "text-purple-600 bg-purple-50/50" :
                          "text-muted-foreground"
                        }`}
                      >
                        <div className="uppercase">{dow}</div>
                        <div className={`text-base font-bold leading-tight ${
                          date === today ? "text-blue-600" : ""
                        }`}>
                          {day}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {/* Occupancy row */}
                {totalRooms > 0 && (
                  <tr className="border-b bg-muted/5">
                    {days.map((date) => {
                      const occ = occForRT[date] ?? 0
                      const pct = totalRooms > 0 ? (occ / totalRooms) * 100 : 0
                      const isPast = date < today
                      return (
                        <td key={date} className="px-2 py-1.5 text-center border-r last:border-r-0">
                          {occ > 0 ? (
                            <div className="space-y-0.5">
                              <div className="text-xs font-medium text-foreground/70">
                                {occ}/{totalRooms}
                              </div>
                              <div className="h-1 rounded-full bg-muted overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${isPast ? "bg-muted-foreground/30" : occColor(pct)}`}
                                  style={{ width: `${Math.min(100, pct)}%` }}
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="h-1 rounded-full bg-muted/50" />
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )}

                {/* Price row */}
                <tr>
                  {days.map((date) => {
                    const rate = rateMap[date]
                    const price = rate?.price ?? null
                    const isClosed = rate?.is_closed ?? false
                    const isPast = date < today
                    const occ = occForRT[date] ?? 0
                    const pct = totalRooms > 0 ? (occ / totalRooms) * 100 : 0
                    const isFull = pct >= 100

                    return (
                      <td
                        key={date}
                        className={`px-1 text-center border-r last:border-r-0 align-top ${
                          isPast ? "opacity-40 bg-muted/10" :
                          isClosed ? "bg-red-50/60" :
                          isFull ? "bg-orange-50/40" :
                          date === today ? "bg-blue-50/40" : ""
                        }`}
                      >
                        {isPast ? (
                          <div className="py-2 text-xs text-muted-foreground/50">
                            {price !== null ? `€${Math.round(price)}` : "—"}
                          </div>
                        ) : (
                          <PriceCell
                            price={price}
                            basePrice={rt?.base_price ?? null}
                            date={date}
                            roomTypeId={selectedRT}
                            isClosed={isClosed}
                            onSaved={handleCellSaved}
                          />
                        )}
                      </td>
                    )
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center flex-wrap gap-x-4 gap-y-1 px-4 py-2.5 border-t text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              Oggi
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-purple-400" />
              Weekend
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Occ. bassa (&lt;30%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-yellow-400" />
              Media (30–60%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-orange-400" />
              Alta (60–90%)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              Quasi pieno (&gt;90%)
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3 w-3 text-red-400" />
              Chiuso
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
