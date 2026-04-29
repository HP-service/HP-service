import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import { RefreshCw } from "lucide-react"
import { ComingSoon } from "../_components/coming-soon"

export default async function IcalPage() {
  await requireRole(MAIN_APP_ROLES)
  return (
    <ComingSoon
      icon={RefreshCw}
      title="iCal Sync"
      description="Sincronizzazione bidirezionale dei calendari con Booking.com, Airbnb, Expedia e altri portali tramite iCal."
      features={[
        "Import automatico prenotazioni da OTA",
        "Export del tuo calendario verso portali esterni",
        "Sincronizzazione configurabile (5min – 1h)",
        "Risoluzione overbooking con alert",
        "Storico sync e log errori",
      ]}
    />
  )
}
