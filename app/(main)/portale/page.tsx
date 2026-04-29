import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import { MessageCircle } from "lucide-react"
import { ComingSoon } from "../_components/coming-soon"

export default async function PortalePage() {
  await requireRole(MAIN_APP_ROLES)
  return (
    <ComingSoon
      icon={MessageCircle}
      title="Portale Ospiti"
      description="Area dedicata ai tuoi ospiti per check-in online, comunicazioni e servizi extra."
      features={[
        "Check-in online pre-arrivo",
        "Servizi extra prenotabili (colazione, parcheggio, transfer)",
        "Guida alla città con attrazioni",
        "Chat diretta con la struttura",
        "Recensioni post check-out",
      ]}
    />
  )
}
