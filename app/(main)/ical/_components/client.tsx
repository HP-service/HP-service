"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Power,
  X,
  Save,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react"
import {
  createIcalSubscription,
  deleteIcalSubscription,
  toggleIcalSubscription,
  syncIcalSubscription,
  syncAllIcalSubscriptions,
} from "@db/queries/ical"

type Subscription = {
  id: string
  room_id: string
  channel_id: string | null
  ical_url: string
  is_active: boolean
  last_synced_at: string | null
  sync_status: string | null
  last_error: string | null
  created_at: string
  room?: { name: string } | null
  channel?: { name: string } | null
}

type RoomOpt = { id: string; name: string }
type ChannelOpt = { id: string; name: string }

export function IcalClient({
  initialSubscriptions,
  rooms,
  channels,
}: {
  initialSubscriptions: Subscription[]
  rooms: RoomOpt[]
  channels: ChannelOpt[]
}) {
  const router = useRouter()
  const [subs] = useState(initialSubscriptions)
  const [editor, setEditor] = useState<{
    room_id: string
    channel_id: string
    ical_url: string
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  function newSub() {
    setEditor({
      room_id: rooms[0]?.id ?? "",
      channel_id: channels[0]?.id ?? "",
      ical_url: "",
    })
  }

  function save() {
    if (!editor) return
    if (!editor.room_id || !editor.ical_url.trim()) {
      toast.error("Compila tutti i campi")
      return
    }
    startTransition(async () => {
      const res = await createIcalSubscription({
        room_id: editor.room_id,
        channel_id: editor.channel_id || null,
        ical_url: editor.ical_url.trim(),
      })
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Sottoscrizione iCal creata")
      setEditor(null)
      router.refresh()
    })
  }

  function syncOne(id: string) {
    startTransition(async () => {
      const res = await syncIcalSubscription(id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      const data = res.data as { created?: number; updated?: number; cancelled?: number } | undefined
      const total = (data?.created ?? 0) + (data?.updated ?? 0)
      toast.success(`Sync OK${data ? ` — ${total} aggiornamenti` : ""}`)
      router.refresh()
    })
  }

  function syncAllNow() {
    if (subs.length === 0) return
    startTransition(async () => {
      const res = await syncAllIcalSubscriptions("@me")
      toast.success(`Sync completata — ${res.synced ?? 0} ok / ${res.errors?.length ?? 0} errori`)
      router.refresh()
    })
  }

  function toggle(id: string, next: boolean) {
    startTransition(async () => {
      const res = await toggleIcalSubscription(id, next)
      if (res.error) {
        toast.error(res.error)
        return
      }
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!confirm("Eliminare questa sottoscrizione?")) return
    startTransition(async () => {
      const res = await deleteIcalSubscription(id)
      if (res.error) {
        toast.error(res.error)
        return
      }
      toast.success("Eliminata")
      router.refresh()
    })
  }

  // KPI
  const okCount = subs.filter((s) => s.sync_status === "ok").length
  const errCount = subs.filter((s) => s.sync_status === "error").length
  const pendingCount = subs.filter((s) => !s.sync_status).length

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={newSub}
          disabled={rooms.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-200 transition-colors hover:bg-indigo-700 disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuova sottoscrizione
        </button>
        <button
          type="button"
          onClick={syncAllNow}
          disabled={isPending || subs.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          Sync ora
        </button>
        <span className="ml-auto text-xs text-slate-500">
          Sync automatica: <strong>ogni 30 minuti</strong>
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Sottoscrizioni"
          value={subs.length}
          accent="from-slate-500 to-slate-300"
        />
        <Kpi
          label="OK"
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
          label="Mai sincronizzate"
          value={pendingCount}
          accent="from-amber-500 to-amber-300"
          icon={<Clock className="h-4 w-4 text-amber-600" />}
        />
      </div>

      {/* Lista */}
      {rooms.length === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          Devi prima creare almeno una camera per associare un calendario iCal.
        </div>
      ) : subs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <LinkIcon className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">
            Nessuna sottoscrizione iCal
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Aggiungi un link iCal da Booking.com, Airbnb o altri portali per
            sincronizzare automaticamente le prenotazioni.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/50">
                <tr className="border-b border-slate-200">
                  <Th>Camera</Th>
                  <Th>Canale</Th>
                  <Th>URL</Th>
                  <Th>Ultimo sync</Th>
                  <Th className="text-center">Stato</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr
                    key={s.id}
                    className={`border-b border-slate-100 last:border-0 ${
                      !s.is_active ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">
                      Camera {s.room?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {s.channel?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <a
                        href={s.ical_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 truncate text-xs text-indigo-600 hover:underline"
                      >
                        <span className="truncate">{s.ical_url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {s.last_synced_at
                        ? new Date(s.last_synced_at).toLocaleString("it-IT", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Mai"}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Status status={s.sync_status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => syncOne(s.id)}
                          disabled={isPending}
                          title="Sincronizza ora"
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggle(s.id, !s.is_active)}
                          disabled={isPending}
                          title={s.is_active ? "Disattiva" : "Attiva"}
                          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(s.id)}
                          disabled={isPending}
                          title="Elimina"
                          className="rounded-lg border border-rose-200 bg-rose-50 p-1.5 text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Editor modal */}
      {editor ? (
        <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-bold text-slate-900">
                Nuova sottoscrizione iCal
              </h2>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600">
                  Camera *
                </label>
                <select
                  value={editor.room_id}
                  onChange={(e) =>
                    setEditor({ ...editor, room_id: e.target.value })
                  }
                  className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      Camera {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600">
                  Canale (opzionale)
                </label>
                <select
                  value={editor.channel_id}
                  onChange={(e) =>
                    setEditor({ ...editor, channel_id: e.target.value })
                  }
                  className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">— Nessuno —</option>
                  {channels.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600">
                  URL calendario iCal *
                </label>
                <input
                  value={editor.ical_url}
                  onChange={(e) =>
                    setEditor({ ...editor, ical_url: e.target.value })
                  }
                  placeholder="https://www.airbnb.it/calendar/ical/..."
                  className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
                <p className="text-[11px] text-slate-400">
                  Lo trovi nelle impostazioni del tuo annuncio su Booking, Airbnb,
                  Expedia.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-200 transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {isPending ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Status({ status }: { status: string | null }) {
  if (status === "ok")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
        <CheckCircle2 className="h-3 w-3" />
        OK
      </span>
    )
  if (status === "error")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">
        <XCircle className="h-3 w-3" />
        Errore
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
      <Clock className="h-3 w-3" />
      Mai
    </span>
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
    <th className={`px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500 ${className}`}>
      {children}
    </th>
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
