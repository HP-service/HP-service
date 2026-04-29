"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Play, CheckCircle2, Clock, BedDouble, User, AlertTriangle } from "lucide-react"
import { startTask, completeTask } from "@db/queries/tasks"

export type PortalTask = {
  id: string
  title: string
  type: string
  status: string
  priority: string
  description: string | null
  estimated_minutes: number | null
  due_date: string | null
  started_at: string | null
  room: { id: string; name: string } | null
  booking: {
    id: string
    booking_number: string
    guest: { full_name: string } | null
    has_early_check_in?: boolean
  } | null
}

const TYPE_CONFIG: Record<string, { label: string; emoji: string; bg: string; border: string }> = {
  CleaningCheckout: { label: "Pulizia Checkout",  emoji: "🧹", bg: "bg-blue-50",   border: "border-blue-200" },
  CleaningStayover: { label: "Pulizia Stayover",  emoji: "🛏️", bg: "bg-sky-50",    border: "border-sky-200" },
  CleaningDeep:     { label: "Pulizia Profonda",  emoji: "✨", bg: "bg-purple-50", border: "border-purple-200" },
  Inspection:       { label: "Ispezione",          emoji: "🔍", bg: "bg-amber-50",  border: "border-amber-200" },
  Maintenance:      { label: "Manutenzione",       emoji: "🔧", bg: "bg-orange-50", border: "border-orange-200" },
}

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  Low:    { label: "Bassa",   className: "bg-slate-100 text-slate-600" },
  Normal: { label: "Normale", className: "bg-blue-100 text-blue-700" },
  High:   { label: "Alta",    className: "bg-amber-100 text-amber-800" },
  Urgent: { label: "URGENTE", className: "bg-red-100 text-red-700 font-bold" },
}

export function TaskCard({ task }: { task: PortalTask }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const typeCfg = TYPE_CONFIG[task.type] ?? { label: task.type, emoji: "📋", bg: "bg-muted", border: "border-border" }
  const prioCfg = PRIORITY_CONFIG[task.priority] ?? { label: task.priority, className: "bg-muted text-muted-foreground" }
  const isInProgress = task.status === "InProgress"

  function handleStart() {
    startTransition(async () => {
      const result = await startTask(task.id)
      if (result.error) toast.error(result.error)
      else { toast.success("Task avviato!"); router.refresh() }
    })
  }

  function handleComplete() {
    startTransition(async () => {
      const result = await completeTask(task.id)
      if (result.error) toast.error(result.error)
      else { toast.success("✅ Task completato!"); router.refresh() }
    })
  }

  return (
    <div className={`rounded-2xl border-2 ${typeCfg.border} ${typeCfg.bg} p-4 space-y-3 ${
      isInProgress ? "ring-2 ring-primary/30 shadow-md" : ""
    }`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{typeCfg.emoji}</span>
          <div>
            <p className="font-semibold leading-tight">{typeCfg.label}</p>
            {isInProgress && (
              <span className="text-xs text-primary font-medium">● In corso</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {task.priority !== "Normal" && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${prioCfg.className}`}>
              {task.priority === "Urgent" && <AlertTriangle className="inline h-3 w-3 mr-0.5" />}
              {prioCfg.label}
            </span>
          )}
        </div>
      </div>

      {/* Room */}
      {task.room && (
        <div className="flex items-center gap-2 text-base font-bold">
          <BedDouble className="h-5 w-5 text-muted-foreground shrink-0" />
          <span>Camera {task.room.name}</span>
        </div>
      )}

      {/* Title / Description */}
      <div>
        <p className="text-sm font-medium">{task.title}</p>
        {task.description && (
          <p className="text-sm text-muted-foreground mt-0.5">{task.description}</p>
        )}
      </div>

      {/* Guest info */}
      {task.booking?.guest && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <User className="h-4 w-4 shrink-0" />
          <span>{task.booking.guest.full_name}</span>
        </div>
      )}

      {/* Estimated time + due date */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {task.estimated_minutes && (
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {task.estimated_minutes} min
          </span>
        )}
        {task.due_date && (
          <span>
            Entro {new Date(task.due_date).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        {!isInProgress && (
          <button
            onClick={handleStart}
            disabled={isPending}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground py-3 text-sm font-semibold active:scale-95 transition-transform disabled:opacity-60"
          >
            <Play className="h-4 w-4" />
            Inizia
          </button>
        )}
        <button
          onClick={handleComplete}
          disabled={isPending}
          className={`flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold active:scale-95 transition-transform disabled:opacity-60 ${
            isInProgress
              ? "flex-1 bg-emerald-500 text-white"
              : "px-4 bg-emerald-100 text-emerald-700"
          }`}
        >
          <CheckCircle2 className="h-4 w-4" />
          {isInProgress ? "Completo!" : ""}
        </button>
      </div>
    </div>
  )
}
