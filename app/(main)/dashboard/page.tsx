export const dynamic = "force-dynamic"

import Link from "next/link"
import {
  getTodayArrivals,
  getTodayDepartures,
  getInHouseCount,
  sweepStaleCheckins,
} from "@db/queries/bookings"
import { getRooms } from "@db/queries/settings"
import { getFinanceStats } from "@db/queries/finance"
import {
  LogIn,
  LogOut,
  Users,
  Plus,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Wrench,
  Sparkles,
  Check,
  X,
  TrendingUp,
} from "lucide-react"

function gradientFromName(name: string): string {
  const s = (name || "?").toLowerCase()
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  const palettes = [
    ["#EC4899", "#BE185D"],
    ["#8B5CF6", "#6D28D9"],
    ["#F59E0B", "#D97706"],
    ["#3B82F6", "#2563EB"],
    ["#10B981", "#059669"],
    ["#6366F1", "#4338CA"],
    ["#06B6D4", "#0E7490"],
  ]
  const [a, b] = palettes[h % palettes.length]
  return `linear-gradient(135deg, ${a}, ${b})`
}

function initials(name: string): string {
  return (name || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function channelBadge(channel: string | null | undefined): {
  label: string
  className: string
} {
  const c = (channel ?? "").toLowerCase()
  if (c.includes("booking"))
    return { label: "Booking.com", className: "bg-blue-100 text-blue-700" }
  if (c.includes("airbnb"))
    return { label: "Airbnb", className: "bg-pink-100 text-pink-700" }
  if (c.includes("expedia"))
    return { label: "Expedia", className: "bg-amber-100 text-amber-800" }
  return { label: channel || "Direct", className: "bg-emerald-100 text-emerald-700" }
}

export default async function DashboardPage() {
  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  await sweepStaleCheckins()

  const [arrivalsResult, departuresResult, inHouseResult, roomsResult, financeResult] =
    await Promise.all([
      getTodayArrivals(),
      getTodayDepartures(),
      getInHouseCount(),
      getRooms(),
      getFinanceStats(),
    ])

  const arrivals = arrivalsResult.data ?? []
  const departures = departuresResult.data ?? []
  const inHouseCount = inHouseResult.data ?? 0
  const allRooms = roomsResult.data ?? []
  const totalRooms = allRooms.filter(
    (r) => r.status === "Available" || r.status === "Occupied",
  ).length
  const occupancyPct = totalRooms > 0 ? Math.round((inHouseCount / totalRooms) * 100) : 0
  const finance = financeResult.data
  const revenue = Math.round(finance?.revenue ?? 0)

  const roomCounts = {
    clean: allRooms.filter((r) => r.cleaning_status === "Clean").length,
    dirty: allRooms.filter((r) => r.cleaning_status === "Dirty").length,
    inProgress: allRooms.filter((r) => r.cleaning_status === "InProgress").length,
    maintenance: allRooms.filter(
      (r) => r.status === "Maintenance" || r.status === "OutOfOrder",
    ).length,
  }
  const totalForBars =
    Math.max(1, roomCounts.clean + roomCounts.dirty + roomCounts.inProgress + roomCounts.maintenance)

  const arrivalsToCheckin = arrivals.filter((a) => a.status !== "CheckedIn").length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Buongiorno
          </h1>
          <p className="mt-0.5 text-sm capitalize text-slate-500">
            Panoramica di oggi · {today}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50">
            <Download className="h-3.5 w-3.5" />
            Report
          </button>
          <Link
            href="/bookings/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-200 transition-colors hover:bg-indigo-700"
          >
            <Plus className="h-3.5 w-3.5" />
            Nuova Prenotazione
          </Link>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          accent="from-indigo-500 to-indigo-400"
          label="Arrivi oggi"
          value={arrivals.length}
          icon={<LogIn className="h-4 w-4 text-indigo-600" />}
          iconBg="bg-indigo-50"
          footer={
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{arrivalsToCheckin} da fare</span>
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                Attivo
              </span>
            </div>
          }
        />
        <KpiCard
          accent="from-amber-500 to-amber-300"
          label="Partenze oggi"
          value={departures.length}
          icon={<LogOut className="h-4 w-4 text-amber-600" />}
          iconBg="bg-amber-50"
          footer={
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">In partenza</span>
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                OK
              </span>
            </div>
          }
        />
        <KpiCard
          accent="from-emerald-500 to-emerald-300"
          label="In casa"
          value={inHouseCount}
          icon={<Users className="h-4 w-4 text-emerald-600" />}
          iconBg="bg-emerald-50"
          footer={
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">{totalRooms} camere totali</span>
              <span className="text-[10px] font-bold text-emerald-700">Live</span>
            </div>
          }
        />
        <KpiCard
          accent="from-blue-500 to-blue-300"
          label="Occupazione"
          value={`${occupancyPct}%`}
          icon={<TrendingUp className="h-4 w-4 text-blue-600" />}
          iconBg="bg-blue-50"
          footer={
            <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
                style={{ width: `${occupancyPct}%` }}
              />
            </div>
          }
        />
      </div>

      {/* Row 2: Revenue + Stato camere */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Revenue del periodo
              </p>
              <div className="text-3xl font-extrabold text-slate-900">
                € {revenue.toLocaleString("it-IT")}
              </div>
            </div>
            <Link
              href="/finance"
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              Vedi finanze →
            </Link>
          </div>
          {/* Spark */}
          <svg viewBox="0 0 520 100" className="mt-2 h-24 w-full">
            <defs>
              <linearGradient id="sparkGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#6366F1" stopOpacity=".25" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 78 C40 70,80 65,120 55 C160 45,200 50,240 35 C280 22,320 30,360 18 C400 8,440 12,480 6 L520 4 L520 100 L0 100 Z"
              fill="url(#sparkGradient)"
            />
            <path
              d="M0 78 C40 70,80 65,120 55 C160 45,200 50,240 35 C280 22,320 30,360 18 C400 8,440 12,480 6 L520 4"
              fill="none"
              stroke="#6366F1"
              strokeWidth={2.2}
              strokeLinecap="round"
            />
            <circle cx="520" cy="4" r="4" fill="#6366F1" />
          </svg>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Stato camere</p>
            <Link href="/rooms" className="text-xs font-semibold text-indigo-600 hover:underline">
              Dettaglio →
            </Link>
          </div>
          <div className="space-y-3">
            <RoomBar
              label="Pulite"
              count={roomCounts.clean}
              total={totalForBars}
              icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              iconBg="bg-emerald-50"
              barColor="bg-emerald-500"
            />
            <RoomBar
              label="Da pulire"
              count={roomCounts.dirty}
              total={totalForBars}
              icon={<AlertTriangle className="h-4 w-4 text-amber-600" />}
              iconBg="bg-amber-50"
              barColor="bg-amber-500"
            />
            <RoomBar
              label="In pulizia"
              count={roomCounts.inProgress}
              total={totalForBars}
              icon={<Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
              iconBg="bg-blue-50"
              barColor="bg-blue-500"
            />
            <RoomBar
              label="Manutenzione"
              count={roomCounts.maintenance}
              total={totalForBars}
              icon={<Wrench className="h-4 w-4 text-rose-500" />}
              iconBg="bg-rose-50"
              barColor="bg-rose-500"
            />
          </div>
        </div>
      </div>

      {/* Row 3: arrivi/partenze */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Arrivi di oggi</p>
            <Link href="/bookings" className="text-xs font-semibold text-indigo-600 hover:underline">
              Vedi tutti →
            </Link>
          </div>
          {arrivals.length === 0 ? (
            <Empty label="Nessun arrivo previsto oggi" />
          ) : (
            <ul className="space-y-1">
              {arrivals.slice(0, 6).map((b) => {
                const ch = channelBadge(b.channel?.name)
                return (
                  <li key={b.id}>
                    <Link
                      href={`/bookings/${b.id}`}
                      className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                    >
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                        style={{ background: gradientFromName(b.guest?.full_name ?? "?") }}
                      >
                        {initials(b.guest?.full_name ?? "?")}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {b.guest?.full_name ?? "Ospite"}
                        </div>
                        <div className="text-xs text-slate-500">
                          Camera {b.room?.number ?? "—"} ·{" "}
                          {Math.max(
                            1,
                            Math.round(
                              (new Date(b.check_out).getTime() -
                                new Date(b.check_in).getTime()) /
                                86400000,
                            ),
                          )}{" "}
                          notti
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${ch.className}`}
                      >
                        {ch.label}
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Partenze di oggi</p>
            <Link href="/bookings" className="text-xs font-semibold text-indigo-600 hover:underline">
              Vedi tutti →
            </Link>
          </div>
          {departures.length === 0 ? (
            <Empty label="Nessuna partenza prevista oggi" />
          ) : (
            <ul className="space-y-1">
              {departures.slice(0, 6).map((b) => (
                <li key={b.id}>
                  <Link
                    href={`/bookings/${b.id}`}
                    className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: gradientFromName(b.guest?.full_name ?? "?") }}
                    >
                      {initials(b.guest?.full_name ?? "?")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {b.guest?.full_name ?? "Ospite"}
                      </div>
                      <div className="text-xs text-slate-500">
                        Camera {b.room?.number ?? "—"} · €{" "}
                        {(b.total_amount ?? 0).toLocaleString("it-IT")}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      Check-out
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Activity placeholder */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="mb-3 text-sm font-semibold text-slate-800">Attività recente</p>
        <ul className="space-y-3 text-sm text-slate-700">
          <ActivityItem
            iconBg="bg-indigo-100"
            icon={<Plus className="h-4 w-4 text-indigo-600" />}
            text={`${arrivals.length} arrivi previsti oggi`}
            sub="aggiornato in tempo reale"
          />
          <ActivityItem
            iconBg="bg-emerald-100"
            icon={<Check className="h-4 w-4 text-emerald-600" />}
            text={`${inHouseCount} ospiti attualmente in casa`}
            sub={`${totalRooms} camere disponibili`}
          />
          <ActivityItem
            iconBg="bg-amber-100"
            icon={<Sparkles className="h-4 w-4 text-amber-600" />}
            text={`${roomCounts.dirty} camere da pulire`}
            sub="vai alla sezione pulizie per assegnarle"
          />
          {roomCounts.maintenance > 0 ? (
            <ActivityItem
              iconBg="bg-rose-100"
              icon={<X className="h-4 w-4 text-rose-600" />}
              text={`${roomCounts.maintenance} camere in manutenzione`}
              sub="non disponibili alla vendita"
            />
          ) : null}
        </ul>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
function KpiCard({
  accent,
  label,
  value,
  icon,
  iconBg,
  footer,
}: {
  accent: string
  label: string
  value: string | number
  icon: React.ReactNode
  iconBg: string
  footer: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${accent}`} />
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
      </div>
      <div className="text-3xl font-extrabold tabular-nums text-slate-900">{value}</div>
      <div className="mt-2">{footer}</div>
    </div>
  )
}

function RoomBar({
  label,
  count,
  total,
  icon,
  iconBg,
  barColor,
}: {
  label: string
  count: number
  total: number
  icon: React.ReactNode
  iconBg: string
  barColor: string
}) {
  const pct = Math.round((count / total) * 100)
  return (
    <div className="flex items-center gap-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">{label}</span>
          <span className="font-bold text-slate-900">{count}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  )
}

function ActivityItem({
  iconBg,
  icon,
  text,
  sub,
}: {
  iconBg: string
  icon: React.ReactNode
  text: string
  sub: string
}) {
  return (
    <li className="flex items-start gap-3">
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${iconBg}`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <p>{text}</p>
        <p className="mt-0.5 text-xs text-slate-400">{sub}</p>
      </div>
    </li>
  )
}

function Empty({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-4 py-8 text-center text-sm text-slate-500">
      {label}
    </div>
  )
}
