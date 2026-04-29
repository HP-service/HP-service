"use client"

import { useState, useTransition, useMemo } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, BarChart3,
  Wand2, CalendarCheck, Pencil, Check, X,
} from "lucide-react"
import { upsertDailyRate, upsertDailyRatesBulk } from "@db/queries/scraping"

// ─── Types ────────────────────────────────────────────────────────────────────

type RoomType = {
  id: string
  name: string
  short_code: string | null
  base_price: number | null
}

type Competitor = {
  id: string
  name: string
  stars: number | null
}

type PriceRow = {
  competitor_id: string
  date: string
  price: number | null
}

type DailyRate = {
  room_type_id: string
  date: string
  price: number | null
  is_closed: boolean | null
}

type Props = {
  roomTypes: RoomType[]
  competitors: Competitor[]
  prices: PriceRow[]
  dailyRates: DailyRate[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMPETITOR_COLORS = [
  "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#f97316",
]
const OUR_COLOR = "#3b82f6"
const AVG_COLOR = "#9ca3af"
const SUGGEST_COLOR = "#10b981"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextDays(n: number): string[] {
  const days: string[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() + i * 86400000)
    days.push(d.toISOString().split("T")[0])
  }
  return days
}

function fmtDate(dateStr: string, short = false) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("it-IT", {
    day: "2-digit",
    month: short ? "2-digit" : "short",
  })
}

function avg(vals: number[]): number | null {
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function calcSuggested(
  marketAvg: number | null,
  deltaValue: number,
  deltaType: "pct" | "eur"
): number | null {
  if (marketAvg === null) return null
  if (deltaType === "pct") return Math.round(marketAvg * (1 + deltaValue / 100))
  return Math.round(marketAvg + deltaValue)
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

const CW = 820
const CH = 270
const PAD = { top: 16, right: 16, bottom: 38, left: 54 }
const IW = CW - PAD.left - PAD.right
const IH = CH - PAD.top - PAD.bottom

type Series = {
  id: string
  label: string
  color: string
  values: (number | null)[]
  dashed?: boolean
  width?: number
}

function pathD(points: [number, number][]): string {
  if (points.length === 0) return ""
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ")
}

function LineChart({
  series, dates, hoveredIdx, onHover,
}: {
  series: Series[]
  dates: string[]
  hoveredIdx: number | null
  onHover: (idx: number | null) => void
}) {
  const allVals = series.flatMap((s) => s.values.filter((v): v is number => v !== null))
  if (allVals.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Nessun dato disponibile — aggiorna i competitor per vedere i prezzi
      </div>
    )
  }

  const minV = Math.max(0, Math.min(...allVals) * 0.88)
  const maxV = Math.max(...allVals) * 1.08

  function toX(i: number) {
    return PAD.left + (dates.length > 1 ? (i / (dates.length - 1)) * IW : IW / 2)
  }
  function toY(v: number) {
    return PAD.top + IH - ((v - minV) / (maxV - minV)) * IH
  }

  const yTicks = 5
  const yStep = (maxV - minV) / yTicks
  const yTickVals = Array.from({ length: yTicks + 1 }, (_, i) => Math.round(minV + i * yStep))

  const xEvery = dates.length <= 10 ? 1 : dates.length <= 20 ? 2 : 3
  const bw = IW / Math.max(dates.length - 1, 1)

  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full h-auto" onMouseLeave={() => onHover(null)}>
      {yTickVals.map((v, i) => {
        const y = toY(v)
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={PAD.left + IW} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={PAD.left - 6} y={y} textAnchor="end" dominantBaseline="middle" fontSize="10" fill="#9ca3af">
              €{v}
            </text>
          </g>
        )
      })}

      {hoveredIdx !== null && (
        <line
          x1={toX(hoveredIdx)} y1={PAD.top}
          x2={toX(hoveredIdx)} y2={PAD.top + IH}
          stroke="#6b7280" strokeWidth="1" strokeDasharray="3,2"
        />
      )}

      {series.map((s) => {
        const segments: [number, number][][] = []
        let cur: [number, number][] = []
        s.values.forEach((v, i) => {
          if (v !== null) {
            cur.push([toX(i), toY(v)])
          } else if (cur.length > 0) {
            segments.push(cur)
            cur = []
          }
        })
        if (cur.length > 0) segments.push(cur)

        return (
          <g key={s.id}>
            {segments.map((seg, si) => (
              <path
                key={si}
                d={pathD(seg)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width ?? 1.5}
                strokeDasharray={s.dashed ? "6,3" : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {s.values.map((v, i) => {
              if (v === null) return null
              const isH = i === hoveredIdx
              return (
                <circle
                  key={i}
                  cx={toX(i)} cy={toY(v)}
                  r={isH ? 4.5 : (s.width ?? 1.5) > 2 ? 3 : 2}
                  fill={s.color}
                  stroke="white" strokeWidth="1.5"
                />
              )
            })}
          </g>
        )
      })}

      {dates.map((d, i) => {
        if (i % xEvery !== 0) return null
        return (
          <text key={d} x={toX(i)} y={PAD.top + IH + 14}
            textAnchor="middle" fontSize="9" fill="#9ca3af">
            {fmtDate(d, true)}
          </text>
        )
      })}

      {dates.map((_, i) => (
        <rect
          key={i}
          x={toX(i) - bw / 2} y={PAD.top}
          width={bw} height={IH}
          fill="transparent"
          onMouseEnter={() => onHover(i)}
        />
      ))}
    </svg>
  )
}

// ─── Inline Price Edit Cell ───────────────────────────────────────────────────

function EditablePrice({
  price,
  date,
  roomTypeId,
  onSaved,
}: {
  price: number | null
  date: string
  roomTypeId: string
  onSaved: (date: string, price: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(price !== null ? String(Math.round(price)) : "")
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const n = parseFloat(val)
    if (isNaN(n) || n <= 0) { toast.error("Prezzo non valido"); return }
    startTransition(async () => {
      const r = await upsertDailyRate(roomTypeId, date, n)
      if (r.error) { toast.error(r.error); return }
      onSaved(date, n)
      setEditing(false)
      toast.success(`Prezzo aggiornato: €${Math.round(n)}`)
    })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1 justify-end">
        <Input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false) }}
          className="h-6 w-16 text-xs text-right p-1"
          autoFocus
          disabled={isPending}
        />
        <button onClick={handleSave} disabled={isPending} className="p-0.5 rounded hover:bg-emerald-50 text-emerald-600">
          <Check className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="p-0.5 rounded hover:bg-red-50 text-red-400">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => { setVal(price !== null ? String(Math.round(price)) : ""); setEditing(true) }}
      className="group flex items-center gap-1 justify-end w-full"
    >
      <span className="font-semibold text-blue-600">
        {price !== null ? `€${Math.round(price)}` : "—"}
      </span>
      <Pencil className="h-3 w-3 text-muted-foreground/50 group-hover:text-blue-400 transition-colors" />
    </button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PriceAnalysis({ roomTypes, competitors, prices, dailyRates }: Props) {
  const router = useRouter()
  const [selectedRT, setSelectedRT] = useState<string>(roomTypes[0]?.id ?? "")
  const [selectedDays, setSelectedDays] = useState<14 | 30>(14)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Competitor selector: all selected by default
  const [selectedComps, setSelectedComps] = useState<Set<string>>(
    new Set(competitors.map((c) => c.id))
  )

  // Delta settings
  const [deltaValue, setDeltaValue] = useState<number>(0)
  const [deltaType, setDeltaType] = useState<"pct" | "eur">("pct")

  // Local override map for optimistic updates: date → price
  const [localPrices, setLocalPrices] = useState<Record<string, number>>({})

  const [isApplyingAll, startApplyAll] = useTransition()

  const dates = getNextDays(selectedDays)
  const rt = roomTypes.find((r) => r.id === selectedRT)

  // ── Our prices ─────────────────────────────────────────────────────────────
  const ourRateMap = useMemo(() => {
    const m: Record<string, number> = {}
    for (const dr of dailyRates) {
      if (dr.room_type_id === selectedRT && dr.price !== null && !dr.is_closed) {
        m[dr.date] = dr.price
      }
    }
    return m
  }, [dailyRates, selectedRT])

  // Merge with local optimistic updates
  const effectiveRateMap = useMemo(() => {
    return { ...ourRateMap, ...localPrices }
  }, [ourRateMap, localPrices])

  const ourValues = dates.map((d) => effectiveRateMap[d] ?? rt?.base_price ?? null)

  // ── Competitor price maps ───────────────────────────────────────────────────
  const compMap = useMemo(() => {
    const m: Record<string, Record<string, number | null>> = {}
    for (const p of prices) {
      if (!m[p.competitor_id]) m[p.competitor_id] = {}
      const ex = m[p.competitor_id][p.date]
      if (ex === undefined || (p.price !== null && (ex === null || p.price < ex))) {
        m[p.competitor_id][p.date] = p.price
      }
    }
    return m
  }, [prices])

  const activeComps = competitors.filter((c) => selectedComps.has(c.id))

  const compValues = competitors.map((c) =>
    dates.map((d) => compMap[c.id]?.[d] ?? null)
  )

  // Market avg using ONLY selected competitors
  const avgValues = dates.map((_, i) => {
    const vals = activeComps
      .map((c) => {
        const ci = competitors.findIndex((cc) => cc.id === c.id)
        return compValues[ci]?.[i] ?? null
      })
      .filter((v): v is number => v !== null)
    return avg(vals)
  })

  // Suggested prices
  const suggestedValues = avgValues.map((m) =>
    calcSuggested(m, deltaValue, deltaType)
  )

  // ── Stats ──────────────────────────────────────────────────────────────────
  const ourAvg = avg(ourValues.filter((v): v is number => v !== null))
  const mktAvg = avg(avgValues.filter((v): v is number => v !== null))
  const allCompFlat = activeComps
    .flatMap((c) => {
      const ci = competitors.findIndex((cc) => cc.id === c.id)
      return compValues[ci] ?? []
    })
    .filter((v): v is number => v !== null)
  const mktMin = allCompFlat.length > 0 ? Math.min(...allCompFlat) : null
  const mktMax = allCompFlat.length > 0 ? Math.max(...allCompFlat) : null

  const positionPct =
    ourAvg !== null && mktAvg !== null && mktAvg > 0
      ? ((ourAvg - mktAvg) / mktAvg) * 100
      : null

  const daysWithMarket = dates.filter((_, i) => avgValues[i] !== null).length
  const daysAbove = dates.filter((_, i) => {
    const o = ourValues[i]
    const m = avgValues[i]
    return o !== null && m !== null && o > m
  }).length

  // Suggested avg
  const sugAvg = avg(suggestedValues.filter((v): v is number => v !== null))

  // ── Recommendation ─────────────────────────────────────────────────────────
  type RecLevel = "good" | "warn" | "danger"
  const rec: { level: RecLevel; title: string; detail: string | null } = (() => {
    if (positionPct === null || daysWithMarket === 0)
      return { level: "good", title: "Aggiungi prezzi competitor per l'analisi", detail: null }
    if (positionPct > 25)
      return {
        level: "danger",
        title: `Sei ${Math.round(positionPct)}% sopra il mercato`,
        detail: mktAvg
          ? `Prezzo competitivo suggerito: €${Math.round(mktAvg * 1.05)} (+5% sulla media)`
          : null,
      }
    if (positionPct > 10)
      return {
        level: "warn",
        title: `Prezzi leggermente alti (+${Math.round(positionPct)}%)`,
        detail: mktAvg
          ? `Considera di portare il prezzo medio verso €${Math.round(mktAvg * 1.10)}`
          : null,
      }
    if (positionPct < -20)
      return {
        level: "warn",
        title: `Sei ${Math.round(Math.abs(positionPct))}% sotto il mercato`,
        detail: mktAvg
          ? `Hai margine per alzare i prezzi fino a €${Math.round(mktAvg * 0.95)}`
          : null,
      }
    if (positionPct < -10)
      return {
        level: "warn",
        title: `Prezzi leggermente bassi (${Math.round(positionPct)}%)`,
        detail: "Potresti ottimizzare il revenue alzando leggermente i prezzi",
      }
    return {
      level: "good",
      title: `Prezzi ben posizionati (${positionPct > 0 ? "+" : ""}${Math.round(positionPct)}% vs mercato)`,
      detail: null,
    }
  })()

  // ── Chart series ───────────────────────────────────────────────────────────
  const series: Series[] = [
    { id: "our", label: "Noi", color: OUR_COLOR, values: ourValues, width: 2.5 },
    { id: "avg", label: "Media mercato", color: AVG_COLOR, values: avgValues, dashed: true, width: 1.5 },
    { id: "sug", label: "Suggerito", color: SUGGEST_COLOR, values: suggestedValues, dashed: true, width: 1.8 },
    ...competitors.map((c, ci) => ({
      id: c.id,
      label: c.name,
      color: COMPETITOR_COLORS[ci % COMPETITOR_COLORS.length],
      values: selectedComps.has(c.id) ? compValues[ci] : compValues[ci].map(() => null),
      width: 1.2,
    })),
  ]

  // ── Hover data ─────────────────────────────────────────────────────────────
  const hovDate = hoveredIdx !== null ? dates[hoveredIdx] : null
  const hov = hovDate
    ? {
        date: hovDate,
        our: ourValues[hoveredIdx!],
        avg: avgValues[hoveredIdx!],
        sug: suggestedValues[hoveredIdx!],
        comps: competitors.map((c, ci) => ({
          name: c.name,
          color: COMPETITOR_COLORS[ci % COMPETITOR_COLORS.length],
          price: compValues[ci][hoveredIdx!],
          active: selectedComps.has(c.id),
        })),
      }
    : null

  // ── Apply single day ────────────────────────────────────────────────────────
  function handleApplyDay(date: string, price: number) {
    setLocalPrices((prev) => ({ ...prev, [date]: price }))
  }

  // ── Apply all month ─────────────────────────────────────────────────────────
  function handleApplyAll() {
    const rows = dates
      .map((d, i) => ({ date: d, price: suggestedValues[i] }))
      .filter((r): r is { date: string; price: number } => r.price !== null)

    if (rows.length === 0) {
      toast.error("Nessun prezzo suggerito disponibile")
      return
    }

    startApplyAll(async () => {
      const result = await upsertDailyRatesBulk(
        rows.map((r) => ({ room_type_id: selectedRT, date: r.date, price: r.price }))
      )
      if (result.error) {
        toast.error(result.error)
      } else {
        const newLocal: Record<string, number> = {}
        rows.forEach((r) => { newLocal[r.date] = r.price })
        setLocalPrices((prev) => ({ ...prev, ...newLocal }))
        toast.success(`${rows.length} prezzi aggiornati`)
        router.refresh()
      }
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-semibold leading-tight">Analisi Prezzi</h2>
            <p className="text-xs text-muted-foreground">Confronto nostri prezzi vs competitor — modifica direttamente dalla tabella</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {roomTypes.length > 1 && (
            <div className="flex items-center gap-0.5 border rounded-lg p-0.5 bg-muted/30">
              {roomTypes.map((r) => (
                <button
                  key={r.id}
                  onClick={() => { setSelectedRT(r.id); setLocalPrices({}) }}
                  className={`text-xs px-3 py-1.5 rounded transition-colors ${
                    r.id === selectedRT
                      ? "bg-background shadow-sm font-medium"
                      : "hover:bg-background/60 text-muted-foreground"
                  }`}
                >
                  {r.short_code ?? r.name}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-1">
            {([14, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setSelectedDays(d)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors ${
                  selectedDays === d
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}gg
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Competitor selector + Delta box ──────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Competitor selector */}
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground mb-2.5">
              Competitor inclusi nella media
            </p>
            <div className="flex flex-wrap gap-2">
              {competitors.map((c, ci) => {
                const active = selectedComps.has(c.id)
                const color = COMPETITOR_COLORS[ci % COMPETITOR_COLORS.length]
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedComps((prev) => {
                        const next = new Set(prev)
                        if (next.has(c.id)) { if (next.size > 1) next.delete(c.id) }
                        else next.add(c.id)
                        return next
                      })
                    }}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all ${
                      active
                        ? "border-transparent text-white shadow-sm"
                        : "border-muted-foreground/20 text-muted-foreground bg-background"
                    }`}
                    style={active ? { backgroundColor: color } : {}}
                  >
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: active ? "rgba(255,255,255,0.7)" : color }}
                    />
                    {c.name.split(" ").slice(0, 2).join(" ")}
                    {c.stars ? ` ${"★".repeat(c.stars)}` : ""}
                  </button>
                )
              })}
              {competitors.length === 0 && (
                <p className="text-xs text-muted-foreground">Nessun competitor disponibile</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground/60 mt-2">
              {selectedComps.size}/{competitors.length} selezionati
            </p>
          </CardContent>
        </Card>

        {/* Delta / Prezzo suggerito box */}
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2 mb-2.5">
              <Wand2 className="h-4 w-4 text-emerald-600" />
              <p className="text-xs font-medium text-emerald-800">Prezzo suggerito = Media + Delta</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 border rounded-lg overflow-hidden bg-background">
                <button
                  onClick={() => setDeltaType("pct")}
                  className={`text-xs px-2.5 py-1.5 transition-colors ${
                    deltaType === "pct"
                      ? "bg-emerald-600 text-white font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  %
                </button>
                <button
                  onClick={() => setDeltaType("eur")}
                  className={`text-xs px-2.5 py-1.5 transition-colors ${
                    deltaType === "eur"
                      ? "bg-emerald-600 text-white font-medium"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  €
                </button>
              </div>
              <Input
                type="number"
                value={deltaValue}
                onChange={(e) => setDeltaValue(parseFloat(e.target.value) || 0)}
                className="h-8 w-20 text-sm text-center"
                step={deltaType === "pct" ? 1 : 5}
              />
              <span className="text-xs text-muted-foreground">
                {deltaType === "pct"
                  ? `${deltaValue >= 0 ? "+" : ""}${deltaValue}% sulla media`
                  : `${deltaValue >= 0 ? "+" : ""}€${deltaValue} sulla media`}
              </span>
            </div>
            {sugAvg !== null && mktAvg !== null && (
              <div className="mt-2.5 flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">
                  Media mercato: <span className="font-medium">€{Math.round(mktAvg)}</span>
                </span>
                <span className="text-emerald-700 font-semibold">
                  → Suggerito: €{Math.round(sugAvg)}
                </span>
              </div>
            )}
            <div className="mt-3">
              <Button
                size="sm"
                onClick={handleApplyAll}
                disabled={isApplyingAll || suggestedValues.every((v) => v === null)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
              >
                <CalendarCheck className="h-3.5 w-3.5 mr-1" />
                {isApplyingAll ? "Applicando..." : `Applica a tutti i ${selectedDays} giorni`}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Nostro prezzo medio</p>
            <p className="text-2xl font-bold text-blue-600">
              {ourAvg !== null ? `€${Math.round(ourAvg)}` : "—"}
            </p>
            {rt?.base_price !== null && rt?.base_price !== undefined && (
              <p className="text-xs text-muted-foreground">Base: €{rt.base_price}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Media mercato</p>
            <p className="text-2xl font-bold">
              {mktAvg !== null ? `€${Math.round(mktAvg)}` : "—"}
            </p>
            {mktMin !== null && mktMax !== null && (
              <p className="text-xs text-muted-foreground">
                Range: €{Math.round(mktMin)}–€{Math.round(mktMax)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Posizionamento</p>
            <p
              className={`text-2xl font-bold flex items-center gap-1 ${
                positionPct === null ? "" : positionPct > 10 ? "text-red-500" : positionPct < -10 ? "text-amber-500" : "text-emerald-600"
              }`}
            >
              {positionPct !== null ? (
                <>
                  {positionPct > 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                  {positionPct > 0 ? "+" : ""}{Math.round(positionPct)}%
                </>
              ) : "—"}
            </p>
            <p className="text-xs text-muted-foreground">rispetto alla media</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-1">Prezzo suggerito medio</p>
            <p className="text-2xl font-bold text-emerald-600">
              {sugAvg !== null ? `€${Math.round(sugAvg)}` : "—"}
            </p>
            {sugAvg !== null && ourAvg !== null && (
              <p className="text-xs text-muted-foreground">
                {sugAvg > ourAvg
                  ? `+€${Math.round(sugAvg - ourAvg)} vs attuale`
                  : sugAvg < ourAvg
                  ? `-€${Math.round(ourAvg - sugAvg)} vs attuale`
                  : "Uguale all'attuale"}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recommendation banner */}
      <div
        className={`flex items-start gap-3 rounded-xl border p-3.5 text-sm ${
          rec.level === "good"
            ? "bg-emerald-50 border-emerald-200"
            : rec.level === "warn"
            ? "bg-amber-50 border-amber-200"
            : "bg-red-50 border-red-200"
        }`}
      >
        {rec.level === "good" ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle
            className={`h-4 w-4 shrink-0 mt-0.5 ${rec.level === "warn" ? "text-amber-500" : "text-red-500"}`}
          />
        )}
        <div>
          <p className={`font-medium ${rec.level === "good" ? "text-emerald-800" : rec.level === "warn" ? "text-amber-800" : "text-red-800"}`}>
            {rec.title}
          </p>
          {rec.detail && (
            <p className={`text-xs mt-0.5 ${rec.level === "good" ? "text-emerald-700" : rec.level === "warn" ? "text-amber-700" : "text-red-700"}`}>
              {rec.detail}
            </p>
          )}
        </div>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <CardTitle className="text-sm">
              Andamento prezzi — {rt?.name}
            </CardTitle>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-5 rounded-full inline-block" style={{ backgroundColor: OUR_COLOR }} />
                <span className="font-medium">Noi</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block" style={{ height: "2px", width: "18px", backgroundColor: AVG_COLOR, borderTop: `2px dashed ${AVG_COLOR}` }} />
                <span className="text-muted-foreground">Media</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block" style={{ height: "2px", width: "18px", backgroundColor: SUGGEST_COLOR, borderTop: `2px dashed ${SUGGEST_COLOR}` }} />
                <span className="text-emerald-600">Suggerito</span>
              </span>
              {competitors.filter((c) => selectedComps.has(c.id)).slice(0, 4).map((c, ci) => {
                const origIdx = competitors.findIndex((cc) => cc.id === c.id)
                return (
                  <span key={c.id} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full inline-block shrink-0" style={{ backgroundColor: COMPETITOR_COLORS[origIdx % COMPETITOR_COLORS.length] }} />
                    <span className="text-muted-foreground truncate max-w-[80px]">{c.name.split(" ").slice(0, 2).join(" ")}</span>
                  </span>
                )
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <LineChart series={series} dates={dates} hoveredIdx={hoveredIdx} onHover={setHoveredIdx} />

          {hov ? (
            <div className="mt-3 rounded-lg border bg-muted/20 p-3">
              <p className="text-xs font-semibold mb-2 text-foreground">{fmtDate(hov.date)}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: OUR_COLOR }} />
                  <span className="text-muted-foreground">Noi:</span>
                  <span className="font-semibold text-blue-600">{hov.our !== null ? `€${Math.round(hov.our)}` : "—"}</span>
                  {hov.our !== null && hov.avg !== null && (
                    <span className={`text-xs font-medium ${hov.our > hov.avg ? "text-red-500" : "text-emerald-600"}`}>
                      ({hov.our > hov.avg ? "+" : ""}{Math.round(((hov.our - hov.avg) / hov.avg) * 100)}%)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="h-px w-3 inline-block shrink-0" style={{ backgroundColor: AVG_COLOR }} />
                  <span className="text-muted-foreground">Media:</span>
                  <span className="font-medium">{hov.avg !== null ? `€${Math.round(hov.avg)}` : "—"}</span>
                </div>
                {hov.sug !== null && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="h-px w-3 inline-block shrink-0" style={{ backgroundColor: SUGGEST_COLOR }} />
                    <span className="text-emerald-700">Suggerito:</span>
                    <span className="font-medium text-emerald-700">{`€${Math.round(hov.sug)}`}</span>
                  </div>
                )}
                {hov.comps.filter((c) => c.active).map((c) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-muted-foreground truncate max-w-[90px]">{c.name.split(" ").slice(0, 2).join(" ")}:</span>
                    <span className="font-medium">{c.price !== null ? `€${Math.round(c.price)}` : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Passa il mouse sul grafico per vedere i dettagli
            </p>
          )}
        </CardContent>
      </Card>

      {/* Day-by-day table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Tabella comparativa — modifica prezzi</CardTitle>
            <Button
              size="sm"
              onClick={handleApplyAll}
              disabled={isApplyingAll || suggestedValues.every((v) => v === null)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white h-7 text-xs"
            >
              <CalendarCheck className="h-3.5 w-3.5 mr-1" />
              {isApplyingAll ? "Applicando..." : "Applica tutti i suggeriti"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Data</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-blue-600 whitespace-nowrap">
                    Noi
                    <span className="ml-1 text-muted-foreground font-normal">(clicca per editare)</span>
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">Media</th>
                  {activeComps.map((c) => {
                    const origIdx = competitors.findIndex((cc) => cc.id === c.id)
                    return (
                      <th
                        key={c.id}
                        className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap"
                        style={{ color: COMPETITOR_COLORS[origIdx % COMPETITOR_COLORS.length] }}
                      >
                        {c.name.split(" ").slice(0, 2).join(" ")}
                      </th>
                    )
                  })}
                  <th className="px-3 py-2.5 text-right font-medium text-muted-foreground whitespace-nowrap">Δ vs media</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-emerald-700 whitespace-nowrap">Suggerito</th>
                  <th className="px-3 py-2.5 text-center font-medium text-muted-foreground whitespace-nowrap">Applica</th>
                </tr>
              </thead>
              <tbody>
                {dates.map((date, i) => {
                  const our = ourValues[i]
                  const mktDay = avgValues[i]
                  const sug = suggestedValues[i]
                  const diff = our !== null && mktDay !== null ? our - mktDay : null
                  const diffPct = diff !== null && mktDay !== null ? (diff / mktDay) * 100 : null
                  const hasData = our !== null || mktDay !== null

                  if (!hasData) return null

                  const sugDiff = sug !== null && our !== null ? sug - our : null

                  return (
                    <tr
                      key={date}
                      className={`border-b last:border-0 transition-colors cursor-default ${
                        hoveredIdx === i ? "bg-blue-50/60" : "hover:bg-muted/20"
                      }`}
                      onMouseEnter={() => setHoveredIdx(i)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    >
                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{fmtDate(date)}</td>
                      <td className="px-3 py-2 text-right">
                        <EditablePrice
                          price={our}
                          date={date}
                          roomTypeId={selectedRT}
                          onSaved={handleApplyDay}
                        />
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">
                        {mktDay !== null ? `€${Math.round(mktDay)}` : "—"}
                      </td>
                      {activeComps.map((c) => {
                        const ci = competitors.findIndex((cc) => cc.id === c.id)
                        const cp = compValues[ci]?.[i] ?? null
                        const dayPrices = activeComps
                          .map((cc) => {
                            const cci = competitors.findIndex((ccc) => ccc.id === cc.id)
                            return compValues[cci]?.[i] ?? null
                          })
                          .filter((v): v is number => v !== null)
                        const isLowest = cp !== null && dayPrices.length > 1 && cp === Math.min(...dayPrices)
                        return (
                          <td key={c.id} className="px-3 py-2 text-right">
                            <span className={isLowest ? "text-emerald-600 font-semibold" : ""}>
                              {cp !== null ? `€${Math.round(cp)}` : "—"}
                            </span>
                          </td>
                        )
                      })}
                      <td className="px-3 py-2 text-right">
                        {diffPct !== null ? (
                          <span className={`font-medium ${diffPct > 15 ? "text-red-500" : diffPct < -15 ? "text-amber-500" : "text-emerald-600"}`}>
                            {diffPct > 0 ? "+" : ""}{Math.round(diffPct)}%
                          </span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {sug !== null ? (
                          <span className="font-semibold text-emerald-700 flex items-center justify-end gap-1">
                            €{Math.round(sug)}
                            {sugDiff !== null && (
                              <span className={`text-xs font-normal ${sugDiff > 0 ? "text-emerald-500" : sugDiff < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                                ({sugDiff > 0 ? "+" : ""}{Math.round(sugDiff)})
                              </span>
                            )}
                          </span>
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {sug !== null ? (
                          <ApplyDayButton
                            date={date}
                            roomTypeId={selectedRT}
                            suggestedPrice={sug}
                            onApplied={handleApplyDay}
                          />
                        ) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Apply Day Button (isolated to avoid re-renders on pending state) ─────────

function ApplyDayButton({
  date,
  roomTypeId,
  suggestedPrice,
  onApplied,
}: {
  date: string
  roomTypeId: string
  suggestedPrice: number
  onApplied: (date: string, price: number) => void
}) {
  const [isPending, start] = useTransition()
  const router = useRouter()

  function apply() {
    start(async () => {
      const r = await upsertDailyRate(roomTypeId, date, suggestedPrice)
      if (r.error) { toast.error(r.error); return }
      onApplied(date, suggestedPrice)
      toast.success(`${new Date(date + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}: €${Math.round(suggestedPrice)}`)
      router.refresh()
    })
  }

  return (
    <button
      onClick={apply}
      disabled={isPending}
      className="flex items-center gap-1 mx-auto text-xs px-2 py-0.5 rounded bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-medium transition-colors disabled:opacity-50"
    >
      <Wand2 className="h-3 w-3" />
      {isPending ? "..." : "Applica"}
    </button>
  )
}
