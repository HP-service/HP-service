export const dynamic = "force-dynamic"

import Link from "next/link"
import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import {
  getRevenueMetrics,
  getForecast90Days,
  getYoYComparison,
  getChannelBreakdown,
} from "@db/queries/analytics"
import {
  TrendingUp,
  TrendingDown,
  BedDouble,
  Euro,
  Percent,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Info,
} from "lucide-react"
import { ForecastChart } from "./_components/forecast-chart"

function formatEur(v: number) {
  return "€ " + Math.round(v).toLocaleString("it-IT")
}

function formatPct(v: number) {
  return Math.round(v * 100) + "%"
}

function deltaPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 1 : 0
  return (current - previous) / previous
}

function DeltaBadge({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.005) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
        <Minus className="h-3 w-3" />
        Stabile
      </span>
    )
  }
  const positive = delta > 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
        positive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
      }`}
    >
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? "+" : ""}
      {Math.round(delta * 100)}%
    </span>
  )
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  await requireRole(MAIN_APP_ROLES)
  const { month } = await searchParams

  const now = new Date()
  const currentMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const [year, m] = currentMonth.split("-").map(Number)
  const startDate = `${year}-${String(m).padStart(2, "0")}-01`
  const endDate = new Date(year, m, 0).toISOString().split("T")[0]

  // Last 12 months selector
  const months: { value: string; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    months.push({
      value,
      label: d.toLocaleDateString("it-IT", { month: "short", year: "numeric" }),
    })
  }

  const [metricsResult, yoyResult, forecastResult, channelResult] = await Promise.all([
    getRevenueMetrics(startDate, endDate),
    getYoYComparison(currentMonth),
    getForecast90Days(),
    getChannelBreakdown(currentMonth),
  ])

  const metrics = metricsResult.data
  const yoy = yoyResult.data
  const forecast = forecastResult.data ?? []
  const channels = channelResult.data ?? []

  const monthLabel = new Date(currentMonth + "-01").toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
  })

  // Forecast totals
  const forecast90Revenue = forecast.reduce((s, f) => s + f.revenue, 0)
  const forecast90OccupiedNights = forecast.reduce((s, f) => s + f.occupiedNights, 0)
  const forecast90AvailableNights = forecast.reduce((s, f) => s + f.availableNights, 0)
  const forecast90Occupancy =
    forecast90AvailableNights > 0 ? forecast90OccupiedNights / forecast90AvailableNights : 0
  const forecast90Adr = forecast90OccupiedNights > 0 ? forecast90Revenue / forecast90OccupiedNights : 0
  const forecast90Revpar =
    forecast90AvailableNights > 0 ? forecast90Revenue / forecast90AvailableNights : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Analytics & Forecast
          </h1>
          <p className="mt-0.5 text-sm capitalize text-slate-500">
            Performance e previsioni · {monthLabel}
          </p>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex flex-wrap gap-1.5">
        {months.map((mo) => (
          <Link
            key={mo.value}
            href={`/analytics?month=${mo.value}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              mo.value === currentMonth
                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                : "border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {mo.label}
          </Link>
        ))}
      </div>

      {/* KPI Cards: ADR / RevPAR / Occupancy */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* ADR */}
        <div className="rounded-2xl border border-indigo-200/60 bg-gradient-to-br from-indigo-50 to-violet-100 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
              <Euro className="h-5 w-5 text-indigo-600" />
            </div>
            {yoy && <DeltaBadge delta={deltaPct(yoy.current.adr, yoy.previous.adr)} />}
          </div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-indigo-400">
            ADR
          </p>
          <p className="text-3xl font-black text-indigo-800">{formatEur(metrics?.adr ?? 0)}</p>
          <p className="mt-1 text-xs text-indigo-500">Average Daily Rate per camera</p>
          {yoy && (
            <p className="mt-1 text-[11px] text-indigo-400">
              YoY: {formatEur(yoy.previous.adr)} ({yoy.previous.startDate.slice(0, 4)})
            </p>
          )}
        </div>

        {/* RevPAR */}
        <div className="rounded-2xl border border-emerald-200/60 bg-gradient-to-br from-emerald-50 to-teal-100 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            {yoy && <DeltaBadge delta={deltaPct(yoy.current.revpar, yoy.previous.revpar)} />}
          </div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-emerald-500">
            RevPAR
          </p>
          <p className="text-3xl font-black text-emerald-800">{formatEur(metrics?.revpar ?? 0)}</p>
          <p className="mt-1 text-xs text-emerald-600">Revenue Per Available Room</p>
          {yoy && (
            <p className="mt-1 text-[11px] text-emerald-500">
              YoY: {formatEur(yoy.previous.revpar)} ({yoy.previous.startDate.slice(0, 4)})
            </p>
          )}
        </div>

        {/* Occupancy */}
        <div className="rounded-2xl border border-orange-200/60 bg-gradient-to-br from-orange-50 to-amber-100 p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/15">
              <Percent className="h-5 w-5 text-orange-600" />
            </div>
            {yoy && <DeltaBadge delta={deltaPct(yoy.current.occupancy, yoy.previous.occupancy)} />}
          </div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-widest text-orange-500">
            Occupancy
          </p>
          <p className="text-3xl font-black text-orange-800">{formatPct(metrics?.occupancy ?? 0)}</p>
          <div className="mt-1 flex items-center gap-1 text-xs text-orange-600">
            <BedDouble className="h-3 w-3" />
            {metrics?.occupiedRoomNights ?? 0} / {metrics?.availableRoomNights ?? 0} room nights
          </div>
          {yoy && (
            <p className="mt-1 text-[11px] text-orange-500">
              YoY: {formatPct(yoy.previous.occupancy)} ({yoy.previous.startDate.slice(0, 4)})
            </p>
          )}
        </div>
      </div>

      {/* Mini metrics row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniCard
          icon={<Euro className="h-3.5 w-3.5" />}
          label="Revenue mese"
          value={formatEur(metrics?.revenue ?? 0)}
        />
        <MiniCard
          icon={<BedDouble className="h-3.5 w-3.5" />}
          label="Camere disponibili"
          value={String(metrics?.totalRooms ?? 0)}
        />
        <MiniCard
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Notti vendute"
          value={String(metrics?.occupiedRoomNights ?? 0)}
        />
        <MiniCard
          icon={<TrendingDown className="h-3.5 w-3.5" />}
          label="Notti vuote"
          value={String((metrics?.availableRoomNights ?? 0) - (metrics?.occupiedRoomNights ?? 0))}
        />
      </div>

      {/* Forecast 90 days */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-1 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Forecast 90 giorni</h2>
            <p className="text-xs text-slate-500">
              Proiezione basata sulle prenotazioni Confirmed / CheckedIn nei prossimi 3 mesi
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-500">Pickup totale</p>
            <p className="text-xl font-black text-indigo-700">{formatEur(forecast90Revenue)}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <ForecastStat label="Occupancy proiettata" value={formatPct(forecast90Occupancy)} accent="emerald" />
          <ForecastStat label="ADR proiettata" value={formatEur(forecast90Adr)} accent="indigo" />
          <ForecastStat label="RevPAR proiettata" value={formatEur(forecast90Revpar)} accent="violet" />
        </div>

        <div className="mt-5">
          <ForecastChart data={forecast} />
        </div>

        {/* Forecast detail per month */}
        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {forecast.map((f) => (
            <div
              key={f.month}
              className="rounded-xl border border-slate-100 bg-slate-50 p-3"
            >
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                {f.label}
              </div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-base font-black text-slate-900">{formatEur(f.revenue)}</span>
                <span className="text-xs font-bold text-emerald-600">{formatPct(f.occupancy)}</span>
              </div>
              <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] text-slate-500">
                <span>ADR: {formatEur(f.adr)}</span>
                <span>RevPAR: {formatEur(f.revpar)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-500"
                  style={{ width: `${Math.min(100, f.occupancy * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Channel breakdown */}
      {channels.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-base font-bold text-slate-900">Breakdown per canale</h2>
          <div className="space-y-3">
            {channels.map((c) => (
              <div key={c.channel} className="flex items-center gap-3">
                <div className="w-32 text-sm font-semibold text-slate-700">{c.channel}</div>
                <div className="flex-1">
                  <div className="h-7 overflow-hidden rounded-lg bg-slate-100">
                    <div
                      className="flex h-full items-center justify-end bg-gradient-to-r from-indigo-500 to-violet-500 px-2 text-[11px] font-bold text-white"
                      style={{ width: `${Math.max(15, c.pct * 100)}%` }}
                    >
                      {formatPct(c.pct)}
                    </div>
                  </div>
                </div>
                <div className="w-28 text-right text-sm font-bold text-slate-900">
                  {formatEur(c.revenue)}
                </div>
                <div className="w-20 text-right text-xs text-slate-500">{c.bookings} pren.</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info note */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-xs text-blue-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <div>
          <p className="font-semibold">Come si calcolano questi indicatori</p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-blue-700/90">
            <li>
              <strong>ADR</strong> = Revenue del periodo / Notti vendute
            </li>
            <li>
              <strong>RevPAR</strong> = Revenue del periodo / (Camere disponibili × Giorni del periodo)
            </li>
            <li>
              <strong>Occupancy</strong> = Notti vendute / Notti disponibili totali
            </li>
            <li>
              Il forecast 90gg non include eventuali prenotazioni future ancora non registrate. È
              un&apos;istantanea del &laquo;pickup&raquo; attuale.
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function MiniCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-black text-slate-900">{value}</p>
    </div>
  )
}

function ForecastStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent: "emerald" | "indigo" | "violet"
}) {
  const palette = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-800",
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-800",
    violet: "border-violet-100 bg-violet-50 text-violet-800",
  }[accent]

  return (
    <div className={`rounded-xl border p-3 ${palette}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{label}</div>
      <div className="mt-1 text-lg font-black">{value}</div>
    </div>
  )
}
