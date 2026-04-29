export const dynamic = "force-dynamic"

import { getTasks } from "@db/queries/tasks"
import { CheckCircle2, Sparkles } from "lucide-react"
import { TaskCard, type PortalTask } from "../_components/task-card"

const HOUSEKEEPING_TYPES = ["CleaningCheckout", "CleaningStayover", "CleaningDeep", "Inspection"]

export default async function HousekeepingPage() {
  const tasksResult = await getTasks({
    types: HOUSEKEEPING_TYPES,
  })

  // RLS scopes results to own tasks + unassigned; filter only active statuses
  const allTasks = (tasksResult.data ?? []) as PortalTask[]
  const myTasks = allTasks.filter((t) => t.status === "Pending" || t.status === "InProgress")

  const inProgress = myTasks.filter((t) => t.status === "InProgress")
  const pending = myTasks.filter((t) => t.status === "Pending")

  if (myTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 pt-16 text-center">
        <div className="rounded-full bg-emerald-100 p-6">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
        </div>
        <h2 className="text-xl font-bold">Tutto pulito!</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Non ci sono task di pulizia assegnati al momento. Ottimo lavoro!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Le mie pulizie
          </h1>
          <p className="text-sm text-muted-foreground">
            {myTasks.length} task{myTasks.length !== 1 ? " attivi" : " attivo"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-emerald-600">{inProgress.length}</p>
          <p className="text-xs text-muted-foreground">in corso</p>
        </div>
      </div>

      {/* In progress first */}
      {inProgress.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-primary">
            ● In corso
          </h2>
          {inProgress.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </section>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Da fare ({pending.length})
          </h2>
          {pending.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </section>
      )}
    </div>
  )
}
