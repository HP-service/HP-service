import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import { CalendarRange } from "lucide-react"
import { ComingSoon } from "../_components/coming-soon"

export default async function RatesPage() {
  await requireRole(MAIN_APP_ROLES)

  return (
    <ComingSoon
      icon={CalendarRange}
      title="Prezzario"
      description="Gestisci le tariffe giorno per giorno per ogni tipologia di camera, con supporto per chiusure, prezzi speciali e restrizioni di soggiorno."
      features={[
        "Tariffe per tipologia camera e data",
        "Chiusura disponibilità per date specifiche",
        "Restrizioni min/max soggiorno",
        "Import tariffe in blocco",
        "Visualizzazione occupazione in griglia",
      ]}
    />
  )
}
