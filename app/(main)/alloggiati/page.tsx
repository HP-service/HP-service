import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import { ShieldCheck } from "lucide-react"
import { ComingSoon } from "../_components/coming-soon"

export default async function AlloggiatiPage() {
  await requireRole(MAIN_APP_ROLES)
  return (
    <ComingSoon
      icon={ShieldCheck}
      title="Alloggiati Web"
      description="Invio automatico delle schedine di check-in al portale Alloggiati Web della Polizia di Stato, conforme alla normativa italiana."
      features={[
        "Connessione diretta al portale Alloggiati Web",
        "Invio automatico schedine entro 24h dal check-in",
        "Validazione documenti e dati anagrafici",
        "Storico ricevute con esito invio",
        "Re-invio automatico in caso di errore",
      ]}
    />
  )
}
