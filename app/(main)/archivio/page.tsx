export const dynamic = "force-dynamic"

import Link from "next/link"
import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import { createClient } from "@/lib/supabase/server"
import {
  Archive,
  ShieldCheck,
  BarChart3,
  Receipt,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Download,
  Filter,
} from "lucide-react"

type DocKind = "alloggiati" | "istat" | "fattura" | "spesa"

type DocRow = {
  id: string
  kind: DocKind
  date: string
  title: string
  subtitle: string
  status: "ok" | "error" | "pending"
  href?: string
  amount?: number
}

const KIND_META: Record<
  DocKind,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  alloggiati: {
    label: "Alloggiati",
    icon: ShieldCheck,
    color: "text-indigo-700",
    bg: "bg-indigo-50",
  },
  istat: { label: "ISTAT", icon: BarChart3, color: "text-violet-700", bg: "bg-violet-50" },
  fattura: { label: "Fattura", icon: FileSpreadsheet, color: "text-emerald-700", bg: "bg-emerald-50" },
  spesa: { label: "Spesa", icon: Receipt, color: "text-amber-700", bg: "bg-amber-50" },
}

function yearMonths() {
  const now = new Date()
  const opts: { value: string; label: string }[] = []
  // ultimi 24 mesi
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    opts.push({
      value,
      label: d.toLocaleDateString("it-IT", { month: "short", year: "numeric" }),
    })
  }
  return opts
}

export default async function ArchivioPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; type?: DocKind | "all" }>
}) {
  const profile = await requireRole(MAIN_APP_ROLES)
  const { month, type } = await searchParams
  const filterType = (type ?? "all") as DocKind | "all"

  const now = new Date()
  const currentMonth =
    month ??
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const [yearStr, monthStr] = currentMonth.split("-")
  const start = `${yearStr}-${monthStr}-01`
  const endDate = new Date(Number(yearStr), Number(monthStr), 0)
  const end = `${yearStr}-${monthStr}-${String(endDate.getDate()).padStart(2, "0")}`

  const supabase = await createClient()
  const pid = profile.property_id ?? ""

  const [allogRes, istatRes, expRes, txRes] = await Promise.all([
    supabase
      .from("alloggiati_submissions")
      .select(
        "id, submitted_at, response_esito, response_error_desc, schedine_count, schedine_valide, booking_id, bookings:booking_id(booking_number, guests:guest_id(full_name))",
      )
      .eq("property_id", pid)
      .gte("submitted_at", start + "T00:00:00")
      .lte("submitted_at", end + "T23:59:59")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("istat_submissions")
      .select("id, submitted_at, data_rilevazione, response_status, camere_occupate")
      .eq("property_id", pid)
      .gte("submitted_at", start + "T00:00:00")
      .lte("submitted_at", end + "T23:59:59")
      .order("submitted_at", { ascending: false }),
    supabase
      .from("expenses")
      .select("id, date, description, amount, vendor")
      .eq("property_id", pid)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false }),
    supabase
      .from("payments")
      .select(
        "id, date, amount, type, folio:folio_id(folio_number, booking:booking_id(id, booking_number, guests:guest_id(full_name)))",
      )
      .eq("property_id", pid)
      .gte("date", start)
      .lte("date", end)
      .order("date", { ascending: false }),
  ])

  const docs: DocRow[] = []

  for (const a of allogRes.data ?? []) {
    const b = a.bookings as unknown as { booking_number: string; guests: { full_name: string } | null } | null
    docs.push({
      id: a.id,
      kind: "alloggiati",
      date: a.submitted_at,
      title: `Schedina ${b?.booking_number ?? "—"}`,
      subtitle: `${b?.guests?.full_name ?? "Ospite"} · ${a.schedine_valide ?? a.schedine_count}/${a.schedine_count} schedine`,
      status:
        a.response_esito === true
          ? "ok"
          : a.response_esito === false
            ? "error"
            : "pending",
      href: a.booking_id ? `/bookings/${a.booking_id}` : "/alloggiati",
    })
  }

  for (const i of istatRes.data ?? []) {
    docs.push({
      id: i.id,
      kind: "istat",
      date: i.submitted_at,
      title: `ISTAT ${i.data_rilevazione}`,
      subtitle: `${i.camere_occupate} camere occupate`,
      status:
        i.response_status === 200 ? "ok" : i.response_status ? "error" : "pending",
      href: "/istat",
    })
  }

  for (const e of expRes.data ?? []) {
    docs.push({
      id: e.id,
      kind: "spesa",
      date: e.date,
      title: e.description ?? "Spesa",
      subtitle: e.vendor || "—",
      amount: Number(e.amount ?? 0),
      status: "ok",
      href: "/finance/expenses",
    })
  }

  for (const t of txRes.data ?? []) {
    const folio = t.folio as unknown as {
      folio_number: string
      booking: { id: string; booking_number: string; guests: { full_name: string } | null } | null
    } | null
    if (t.type === "Refund") continue
    docs.push({
      id: t.id,
      kind: "fattura",
      date: t.date,
      title: folio?.folio_number ?? "Pagamento",
      subtitle: folio?.booking?.guests?.full_name ?? "—",
      amount: Number(t.amount ?? 0),
      status: "ok",
      href: folio?.booking ? `/bookings/${folio.booking.id}` : undefined,
    })
  }

  // Filtra per tipo
  const filtered =
    filterType === "all" ? docs : docs.filter((d) => d.kind === filterType)
  filtered.sort((a, b) => (a.date < b.date ? 1 : -1))

  const counts = {
    all: docs.length,
    alloggiati: docs.filter((d) => d.kind === "alloggiati").length,
    istat: docs.filter((d) => d.kind === "istat").length,
    fattura: docs.filter((d) => d.kind === "fattura").length,
    spesa: docs.filter((d) => d.kind === "spesa").length,
  }

  const months = yearMonths()
  const exportHref = `/api/archivio/export?month=${currentMonth}${filterType !== "all" ? `&type=${filterType}` : ""}`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-md">
            <Archive className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Archivio documenti
            </h1>
            <p className="text-sm text-slate-500">
              Schedine, ISTAT, fatture e spese — conservazione 5–10 anni come da
              normativa italiana.
            </p>
          </div>
        </div>
        <Link
          href={exportHref}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          Export CSV mese
        </Link>
      </div>

      {/* Filtro mese + tipo */}
      <form
        method="GET"
        action="/archivio"
        className="flex flex-wrap items-center gap-2"
      >
        <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
          <Filter className="h-3.5 w-3.5 text-slate-500" />
          <select
            name="month"
            defaultValue={currentMonth}
            className="border-0 bg-transparent text-xs font-semibold text-slate-700 outline-none"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        {filterType !== "all" ? (
          <input type="hidden" name="type" value={filterType} />
        ) : null}
        <button
          type="submit"
          className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
        >
          Aggiorna
        </button>
      </form>

      {/* Tab tipi */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-100 p-1">
        <TabPill
          active={filterType === "all"}
          href={`/archivio?month=${currentMonth}`}
          label={`Tutti (${counts.all})`}
        />
        <TabPill
          active={filterType === "alloggiati"}
          href={`/archivio?month=${currentMonth}&type=alloggiati`}
          label={`Alloggiati (${counts.alloggiati})`}
        />
        <TabPill
          active={filterType === "istat"}
          href={`/archivio?month=${currentMonth}&type=istat`}
          label={`ISTAT (${counts.istat})`}
        />
        <TabPill
          active={filterType === "fattura"}
          href={`/archivio?month=${currentMonth}&type=fattura`}
          label={`Fatture (${counts.fattura})`}
        />
        <TabPill
          active={filterType === "spesa"}
          href={`/archivio?month=${currentMonth}&type=spesa`}
          label={`Spese (${counts.spesa})`}
        />
      </div>

      {/* Lista documenti */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
              <Archive className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              Nessun documento per questo periodo
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map((d) => {
              const meta = KIND_META[d.kind]
              const Icon = meta.icon
              return (
                <li key={`${d.kind}-${d.id}`}>
                  <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50">
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.bg}`}>
                      <Icon className={`h-4 w-4 ${meta.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900 truncate">
                          {d.title}
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${meta.bg} ${meta.color}`}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {d.subtitle}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-semibold text-slate-700">
                        {new Date(d.date).toLocaleDateString("it-IT", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "2-digit",
                        })}
                      </div>
                      {d.amount != null ? (
                        <div className="text-xs font-bold tabular-nums text-slate-900">
                          € {d.amount.toLocaleString("it-IT")}
                        </div>
                      ) : (
                        <StatusBadge status={d.status} />
                      )}
                    </div>
                    {d.href ? (
                      <Link
                        href={d.href}
                        className="ml-2 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-indigo-600"
                        title="Apri"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Note legali */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-600">
        <p className="font-semibold">Conservazione legale</p>
        <ul className="mt-1.5 space-y-0.5">
          <li>• <strong>Schedine Alloggiati Web</strong>: 5 anni dall&apos;invio</li>
          <li>• <strong>Conferme ISTAT</strong>: 5 anni</li>
          <li>• <strong>Fatture e ricevute</strong>: 10 anni (art. 2220 c.c.)</li>
          <li>• <strong>Documenti tassa soggiorno e F24</strong>: 10 anni</li>
        </ul>
      </div>
    </div>
  )
}

function TabPill({ active, href, label }: { active: boolean; href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
        active
          ? "bg-white text-slate-900 shadow-sm"
          : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {label}
    </Link>
  )
}

function StatusBadge({ status }: { status: "ok" | "error" | "pending" }) {
  if (status === "ok")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" /> OK
      </span>
    )
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700">
        <XCircle className="h-3 w-3" /> Errore
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700">
      <Clock className="h-3 w-3" /> In attesa
    </span>
  )
}
