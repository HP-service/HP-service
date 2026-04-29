"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus, Filter, X, AlertTriangle, Clock, BedDouble, User,
  CheckCircle2, Play, XCircle, ChevronDown,
} from "lucide-react"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ui/dialog"
import { createTask, updateTask, cancelTask } from "@db/queries/tasks"

// ─── Types ────────────────────────────────────────────────────────────────────

type Task = {
  id: string
  title: string
  type: string
  status: string
  priority: string
  description: string | null
  estimated_minutes: number | null
  due_date: string | null
  room: { id: string; name: string } | null
  assigned_to_profile: { id: string; full_name: string; role: string } | null
  booking: { id: string; booking_number: string; guest: { full_name: string } | null } | null
}

type Room = { id: string; name: string; floor: number | null }
type Staff = { id: string; full_name: string; role: string }

type Props = {
  tasks: Task[]
  rooms: Room[]
  staff: Staff[]
  propertyId: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; emoji: string }> = {
  CleaningCheckout: { label: "Pulizia Checkout",  emoji: "🧹" },
  CleaningStayover: { label: "Pulizia Stayover",  emoji: "🛏️" },
  CleaningDeep:     { label: "Pulizia Fondo",     emoji: "✨" },
  Maintenance:      { label: "Manutenzione",      emoji: "🔧" },
  Inspection:       { label: "Ispezione",          emoji: "🔍" },
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  Pending:   { label: "In attesa",  className: "bg-slate-100 text-slate-700" },
  InProgress: { label: "In corso",  className: "bg-blue-100 text-blue-700" },
  Completed: { label: "Completato", className: "bg-emerald-100 text-emerald-700" },
  Cancelled: { label: "Annullato",  className: "bg-red-100 text-red-600 line-through" },
}

const PRIORITY_CONFIG: Record<string, { label: string; dotClass: string }> = {
  Low:    { label: "Bassa",    dotClass: "bg-slate-400" },
  Normal: { label: "Normale",  dotClass: "bg-blue-400" },
  High:   { label: "Alta",     dotClass: "bg-amber-500" },
  Urgent: { label: "Urgente",  dotClass: "bg-red-500" },
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function HousekeepingClient({ tasks, rooms, staff, propertyId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Filters
  const [filterStatus, setFilterStatus] = useState<string>("active")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterAssigned, setFilterAssigned] = useState<string>("all")
  const [filterPeriod, setFilterPeriod] = useState<string>("week")

  // Create dialog
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    type: "CleaningCheckout",
    priority: "Normal",
    title: "",
    description: "",
    room_id: "",
    assigned_to: "",
    estimated_minutes: "",
    due_date: "",
  })

  // Assign dropdown open
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null)

  // ── Filtering ──────────────────────────────────────────────────────────────
  const todayStr = new Date().toISOString().slice(0, 10)
  const weekEnd = new Date(); weekEnd.setDate(weekEnd.getDate() + 7)
  const weekEndStr = weekEnd.toISOString().slice(0, 10)

  const filtered = tasks.filter((t) => {
    // Period filter (based on due_date; no due_date → always show)
    if (filterPeriod !== "all" && t.due_date) {
      const due = t.due_date.slice(0, 10)
      if (filterPeriod === "today" && due !== todayStr) return false
      if (filterPeriod === "week" && due > weekEndStr) return false
    }
    if (filterStatus === "active" && (t.status === "Completed" || t.status === "Cancelled")) return false
    if (filterStatus !== "active" && filterStatus !== "all" && t.status !== filterStatus) return false
    if (filterType !== "all" && t.type !== filterType) return false
    if (filterAssigned === "unassigned" && t.assigned_to_profile) return false
    if (filterAssigned !== "all" && filterAssigned !== "unassigned" && t.assigned_to_profile?.id !== filterAssigned) return false
    return true
  })

  // Sort: Urgent > High > Normal > Low, then InProgress first
  const PRIORITY_ORDER: Record<string, number> = { Urgent: 0, High: 1, Normal: 2, Low: 3 }
  const STATUS_SORT: Record<string, number> = { InProgress: 0, Pending: 1, Completed: 2, Cancelled: 3 }
  const sorted = [...filtered].sort((a, b) => {
    const sd = (STATUS_SORT[a.status] ?? 9) - (STATUS_SORT[b.status] ?? 9)
    if (sd !== 0) return sd
    return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
  })

  // Stats (based on filtered tasks for relevance)
  const pending = filtered.filter(t => t.status === "Pending").length
  const inProgress = filtered.filter(t => t.status === "InProgress").length
  // "Completati oggi" always counts only today's completions (across all tasks)
  const completedToday = tasks.filter(t => t.status === "Completed" && t.due_date?.slice(0, 10) === todayStr).length
  const urgent = filtered.filter(t => (t.status === "Pending" || t.status === "InProgress") && t.priority === "Urgent").length

  // ── Create task ────────────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.type || !form.title) { toast.error("Compila tipo e titolo"); return }

    startTransition(async () => {
      const result = await createTask(propertyId, {
        type: form.type,
        priority: form.priority,
        title: form.title,
        description: form.description || undefined,
        room_id: (form.room_id && form.room_id !== "__none__") ? form.room_id : null,
        assigned_to: (form.assigned_to && form.assigned_to !== "__none__") ? form.assigned_to : null,
        estimated_minutes: form.estimated_minutes ? parseInt(form.estimated_minutes) : undefined,
        due_date: form.due_date || undefined,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Task creato")
        setShowCreate(false)
        setForm({ type: "CleaningCheckout", priority: "Normal", title: "", description: "", room_id: "", assigned_to: "", estimated_minutes: "", due_date: "" })
        router.refresh()
      }
    })
  }

  // ── Quick assign ───────────────────────────────────────────────────────────
  async function handleAssign(taskId: string, staffId: string) {
    startTransition(async () => {
      const result = await updateTask(taskId, { assigned_to: staffId || null })
      if (result.error) toast.error(result.error)
      else { toast.success("Assegnato"); setAssigningTaskId(null); router.refresh() }
    })
  }

  // ── Cancel task ────────────────────────────────────────────────────────────
  async function handleCancel(taskId: string) {
    if (!confirm("Annullare questo task?")) return
    startTransition(async () => {
      const result = await cancelTask(taskId)
      if (result.error) toast.error(result.error)
      else { toast.success("Task annullato"); router.refresh() }
    })
  }

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "In attesa", value: pending, color: "text-slate-700", bg: "bg-slate-50", border: "border-slate-200", dot: "bg-slate-400" },
          { label: "In corso",  value: inProgress, color: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200", dot: "bg-blue-500" },
          { label: "Completati oggi", value: completedToday, color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500" },
          { label: "Urgenti",  value: urgent, color: "text-red-600", bg: urgent > 0 ? "bg-red-50" : "bg-muted", border: urgent > 0 ? "border-red-200" : "border-border", dot: urgent > 0 ? "bg-red-500" : "bg-muted-foreground/30" },
        ].map(({ label, value, color, bg, border, dot }) => (
          <div key={label} className={`rounded-2xl border p-4 ${bg} ${border}`}>
            <div className={`w-2 h-2 rounded-full ${dot} mb-2`} />
            <div className={`text-2xl font-black ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5 font-medium">{label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Period filter */}
        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Oggi</SelectItem>
            <SelectItem value="week">Questa settimana</SelectItem>
            <SelectItem value="all">Tutto il periodo</SelectItem>
          </SelectContent>
        </Select>

        {/* Status filter */}
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Attivi</SelectItem>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="Pending">In attesa</SelectItem>
            <SelectItem value="InProgress">In corso</SelectItem>
            <SelectItem value="Completed">Completati</SelectItem>
            <SelectItem value="Cancelled">Annullati</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-44 text-xs">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterAssigned} onValueChange={setFilterAssigned}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Assegnato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="unassigned">Non assegnati</SelectItem>
            {staff.map(s => (
              <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {(filterPeriod !== "week" || filterStatus !== "active" || filterType !== "all" || filterAssigned !== "all") && (
          <button
            onClick={() => { setFilterPeriod("week"); setFilterStatus("active"); setFilterType("all"); setFilterAssigned("all") }}
            className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Reset
          </button>
        )}

        <div className="flex-1" />

        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nuovo Task
        </Button>
      </div>

      {/* Task table */}
      {sorted.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <p className="font-semibold text-foreground">Tutto in ordine!</p>
          <p className="text-sm text-muted-foreground mt-1">Nessun task trovato con i filtri correnti.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-x-auto shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-3 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Priorità</th>
                <th className="px-3 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Tipo / Task</th>
                <th className="px-3 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Camera</th>
                <th className="px-3 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Assegnato a</th>
                <th className="px-3 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Stato</th>
                <th className="px-3 py-3 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((task) => {
                const typeCfg = TYPE_CONFIG[task.type] ?? { label: task.type, emoji: "📋" }
                const statusCfg = STATUS_CONFIG[task.status] ?? { label: task.status, className: "bg-muted" }
                const prioCfg = PRIORITY_CONFIG[task.priority] ?? { label: task.priority, dotClass: "bg-gray-400" }
                const isActive = task.status === "Pending" || task.status === "InProgress"

                return (
                  <tr key={task.id} className={`border-b last:border-0 hover:bg-muted/20 ${
                    task.status === "Cancelled" ? "opacity-50" : ""
                  }`}>
                    {/* Priority */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full shrink-0 ${prioCfg.dotClass}`} />
                        <span className="text-xs text-muted-foreground">{prioCfg.label}</span>
                      </div>
                    </td>

                    {/* Type + title */}
                    <td className="px-3 py-2.5">
                      <p className="text-xs text-muted-foreground">{typeCfg.emoji} {typeCfg.label}</p>
                      <p className="font-medium leading-tight">{task.title}</p>
                      {task.booking?.guest && (
                        <p className="text-xs text-muted-foreground">{task.booking.guest.full_name}</p>
                      )}
                    </td>

                    {/* Room */}
                    <td className="px-3 py-2.5">
                      {task.room ? (
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 text-white px-2 py-0.5 text-xs font-bold">
                          <BedDouble className="h-3 w-3" />
                          {task.room.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Assigned */}
                    <td className="px-3 py-2.5">
                      {isActive ? (
                        <div className="relative">
                          <button
                            onClick={() => setAssigningTaskId(assigningTaskId === task.id ? null : task.id)}
                            className="flex items-center gap-1 text-xs hover:text-foreground text-muted-foreground rounded px-1.5 py-1 hover:bg-muted transition-colors"
                          >
                            <User className="h-3 w-3 shrink-0" />
                            {task.assigned_to_profile?.full_name ?? "Non assegnato"}
                            <ChevronDown className="h-3 w-3" />
                          </button>
                          {assigningTaskId === task.id && (
                            <div className="absolute top-full left-0 mt-1 z-20 min-w-[160px] rounded-lg border bg-popover shadow-md py-1">
                              <button
                                onClick={() => handleAssign(task.id, "")}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted"
                              >
                                Rimuovi assegnazione
                              </button>
                              {staff.map(s => (
                                <button
                                  key={s.id}
                                  onClick={() => handleAssign(task.id, s.id)}
                                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted"
                                >
                                  {s.full_name}
                                  <span className="ml-1 text-muted-foreground">({s.role})</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {task.assigned_to_profile?.full_name ?? "—"}
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.className}`}>
                        {statusCfg.label}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-3 py-2.5 text-right">
                      {isActive && (
                        <button
                          onClick={() => handleCancel(task.id)}
                          disabled={isPending}
                          className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                          title="Annulla task"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create task dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Tipo *</Label>
                <Select value={form.type} onValueChange={(v) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Priorità</Label>
                <Select value={form.priority} onValueChange={(v) => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Bassa</SelectItem>
                    <SelectItem value="Normal">Normale</SelectItem>
                    <SelectItem value="High">Alta</SelectItem>
                    <SelectItem value="Urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Titolo *</Label>
              <Input
                placeholder="es. Pulizia camera con cambio biancheria"
                value={form.title}
                onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Note / Descrizione</Label>
              <Input
                placeholder="Istruzioni aggiuntive..."
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Camera</Label>
                <Select value={form.room_id} onValueChange={(v) => setForm(f => ({ ...f, room_id: v }))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Nessuna</SelectItem>
                    {rooms.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}{r.floor != null ? ` (P${r.floor})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Assegna a</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm(f => ({ ...f, assigned_to: v }))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Non assegnato" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Non assegnato</SelectItem>
                    {staff.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Durata stimata (min)</Label>
                <Input
                  type="number"
                  min="0"
                  placeholder="30"
                  value={form.estimated_minutes}
                  onChange={(e) => setForm(f => ({ ...f, estimated_minutes: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Entro (orario)</Label>
                <Input
                  type="datetime-local"
                  value={form.due_date}
                  onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" className="flex-1" disabled={isPending}>
                {isPending ? "Creazione..." : "Crea Task"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                Annulla
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
