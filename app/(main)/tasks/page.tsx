import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import { ClipboardList } from "lucide-react"
import { ComingSoon } from "../_components/coming-soon"

export default async function TasksPage() {
  await requireRole(MAIN_APP_ROLES)

  return (
    <ComingSoon
      icon={ClipboardList}
      title="Task & Pulizie"
      description="Gestisci le pulizie e i task operativi del tuo hotel, con assegnazione allo staff, monitoraggio dello stato camere e storico attività."
      features={[
        "Stato pulizia camere in tempo reale",
        "Assegnazione task a Housekeeping e Maintenance",
        "Dashboard riepilogativa per piano",
        "Ciclo camera: Dirty → InProgress → Inspection → Clean",
        "Storico attività e reportistica",
      ]}
    />
  )
}
