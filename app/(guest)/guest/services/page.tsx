import { getGuestSession, getPortalData } from "@db/queries/guest-portal"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Badge } from "@ui/badge"
import { BottomNav } from "../_components/bottom-nav"
import { WhatsAppButton } from "../_components/whatsapp-button"

const CATEGORY_LABELS: Record<string, string> = {
  tour: "Tour & Escursioni",
  restaurant: "Ristoranti & Cucina",
  transfer: "Transfer & Trasporti",
  spa: "Benessere & Spa",
  general: "Altro",
}

const CATEGORY_ORDER = ["tour", "restaurant", "transfer", "spa", "general"]

export default async function GuestServicesPage() {
  const session = await getGuestSession()
  if (!session) redirect("/guest")

  const { services, property } = await getPortalData(session.property_id)
  const settings = (property?.settings ?? {}) as Record<string, string>
  const whatsappNumber = settings.portal_whatsapp_number ?? ""

  // Group by category
  const grouped = new Map<string, typeof services>()
  for (const s of services) {
    const cat = s.category ?? "general"
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(s)
  }

  const sortedCategories = [...grouped.keys()].sort(
    (a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b)
  )

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-br from-purple-600 to-purple-700 px-4 pb-6 pt-10 text-white">
        <h1 className="text-2xl font-bold">Servizi</h1>
        <p className="mt-1 text-sm opacity-80">Scopri e richiedi i servizi disponibili</p>
      </div>

      <div className="space-y-6 px-4 pt-4">
        {services.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nessun servizio disponibile al momento
          </p>
        ) : (
          sortedCategories.map((cat) => (
            <div key={cat}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[cat] ?? cat}
              </h2>
              <div className="space-y-3">
                {grouped.get(cat)!.map((service) => (
                  <Card key={service.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-base">{service.name}</CardTitle>
                        {service.price != null && (
                          <Badge variant="secondary" className="text-sm">
                            €{Number(service.price).toFixed(2)}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {service.description && (
                        <p className="text-sm text-muted-foreground">
                          {service.description}
                        </p>
                      )}
                      {whatsappNumber && (
                        <WhatsAppButton
                          phoneNumber={whatsappNumber}
                          message={`Salve, sono ${session.guest_name} nella camera ${session.room_name}. Vorrei richiedere: ${service.name}. `}
                          label="Richiedi"
                          className="w-full"
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  )
}
