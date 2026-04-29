export const dynamic = "force-dynamic"

import Link from "next/link"
import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import { createClient } from "@/lib/supabase/server"
import {
  ShieldCheck,
  Settings,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
} from "lucide-react"

type Submission = {
  id: string
  booking_id: string
  method: string
  schedine_count: number
  schedine_valide: number | null
  response_esito: boolean | null
  response_error_code: string | null
  response_error_desc: string | null
  submitted_at: string
  bookings: {
    booking_number: string
    guests: { full_name: string } | null
  } | null
}

export default async function AlloggiatiPage() {
  const profile = await requireRole(MAIN_APP_ROLES)
  const supabase = await createClient()

  // Carica credenziali property + ultime 50 submissions
  const [{ data: property }, { data: submissionsRaw }] = await Promise.all([
    supabase
      .from("properties")
      .select("settings")
      .eq("id", profile.property_id ?? "")
      .single(),
    supabase
      .from("alloggiati_submissions")
      .select(
        `id, booking_id, method, schedine_count, schedine_valide,
         response_esito, response_error_code, response_error_desc, submitted_at,
         bookings:booking_id ( booking_number, guests:guest_id ( full_name ) )`,
      )
      .eq("property_id", profile.property_id ?? "")
      .order("submitted_at", { ascending: false })
      .limit(50),
  ])

  const settings = (property?.settings ?? {}) as Record<string, string>
  const hasCredentials = !!(
    settings.alloggiati_username &&
    settings.alloggiati_password &&
    settings.alloggiati_wskey
  )

  const submissions = (submissionsRaw ?? []) as unknown as Submission[]

  // KPI
  const totSubs = submissions.length
  const okCount = submissions.filter((s) => s.response_esito === true).length
  const errCount = submissions.filter((s) => s.response_esito === false).length
  const pendingCount = submissions.filter((s) => s.response_esito === null).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              Alloggiati Web
            </h1>
            <p className="text-sm text-slate-500">
              Schedine inviate alla Polizia di Stato — ultimi 50 invii
            </p>
          </div>
        </div>
        <Link
          href="/settings?tab=alloggiati"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Settings className="h-3.5 w-3.5" />
          Configurazione
        </Link>
      </div>

      {/* Stato credenziali */}
      {!hasCredentials ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <AlertTriangle className="h-5 w-5 text-amber-700" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-900">
                Credenziali non configurate
              </p>
              <p className="mt-0.5 text-xs text-amber-800">
                Per inviare automaticamente le schedine devi configurare le
                credenziali del portale Alloggiati Web (username, password,
                WS-Key).
              </p>
              <Link
                href="/settings?tab=alloggiati"
                className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-amber-900 hover:underline"
              >
                Vai a configurazione →
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            <p className="text-sm font-semibold text-emerald-900">
              Credenziali configurate. Le schedine vengono inviate automaticamente
              al check-in.
            </p>
          </div>
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Invii totali" value={totSubs} accent="from-slate-500 to-slate-300" />
        <Kpi
          label="Riuscite"
          value={okCount}
          accent="from-emerald-500 to-emerald-300"
          icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        />
        <Kpi
          label="Errori"
          value={errCount}
          accent="from-rose-500 to-rose-300"
          icon={<XCircle className="h-4 w-4 text-rose-600" />}
        />
        <Kpi
          label="In attesa"
          value={pendingCount}
          accent="from-amber-500 to-amber-300"
          icon={<Clock className="h-4 w-4 text-amber-600" />}
        />
      </div>

      {/* Lista submissions */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 px-5 py-3.5">
          <p className="text-sm font-semibold text-slate-800">Storico invii</p>
        </div>
        {submissions.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
              <ShieldCheck className="h-6 w-6 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-700">
              Nessuna schedina inviata
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Le schedine vengono create automaticamente al check-in degli ospiti.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50">
                <tr className="border-b border-slate-200">
                  <Th>Data invio</Th>
                  <Th>Prenotazione</Th>
                  <Th>Ospite</Th>
                  <Th className="text-center">Schedine</Th>
                  <Th>Esito</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-100 transition-colors hover:bg-slate-50/40 last:border-0"
                  >
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {new Date(s.submitted_at).toLocaleString("it-IT", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700">
                        {s.bookings?.booking_number ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                      {s.bookings?.guests?.full_name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-bold tabular-nums text-slate-900">
                        {s.schedine_valide ?? s.schedine_count}
                      </span>
                      <span className="ml-0.5 text-xs text-slate-400">
                        /{s.schedine_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Esito s={s} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/bookings/${s.booking_id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        Vedi
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer link tornare back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Dashboard
      </Link>
    </div>
  )
}

function Kpi({
  label,
  value,
  accent,
  icon,
}: {
  label: string
  value: number
  accent: string
  icon?: React.ReactNode
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5">
      <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${accent}`} />
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
          {label}
        </span>
        {icon}
      </div>
      <div className="text-3xl font-extrabold tabular-nums text-slate-900">{value}</div>
    </div>
  )
}

function Th({
  children,
  className = "",
}: {
  children?: React.ReactNode
  className?: string
}) {
  return (
    <th
      className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 ${className}`}
    >
      {children}
    </th>
  )
}

function Esito({ s }: { s: Submission }) {
  if (s.response_esito === true) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        Inviata
      </span>
    )
  }
  if (s.response_esito === false) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-rose-700"
        title={s.response_error_desc ?? s.response_error_code ?? ""}
      >
        <XCircle className="h-3 w-3" />
        Errore
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold text-amber-700">
      <Clock className="h-3 w-3" />
      In attesa
    </span>
  )
}
