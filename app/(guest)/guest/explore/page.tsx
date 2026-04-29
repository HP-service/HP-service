import { getGuestSession, getPortalData } from "@db/queries/guest-portal"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Button } from "@ui/button"
import { ExternalLink, MapPin, Lightbulb, Bus } from "lucide-react"
import { BottomNav } from "../_components/bottom-nav"

const CATEGORY_CONFIG: Record<string, { label: string; icon: typeof MapPin; color: string }> = {
  attraction: { label: "Attrazioni", icon: MapPin, color: "text-red-600 bg-red-100" },
  tip: { label: "Consigli", icon: Lightbulb, color: "text-amber-600 bg-amber-100" },
  transport: { label: "Trasporti", icon: Bus, color: "text-blue-600 bg-blue-100" },
}

const CATEGORY_ORDER = ["attraction", "tip", "transport"]

export default async function GuestExplorePage() {
  const session = await getGuestSession()
  if (!session) redirect("/guest")

  const { attractions } = await getPortalData(session.property_id)

  // Group by category
  const grouped = new Map<string, typeof attractions>()
  for (const a of attractions) {
    const cat = a.category ?? "attraction"
    if (!grouped.has(cat)) grouped.set(cat, [])
    grouped.get(cat)!.push(a)
  }

  const sortedCategories = CATEGORY_ORDER.filter((c) => grouped.has(c))

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-4 pb-6 pt-10 text-white">
        <h1 className="text-2xl font-bold">Esplora</h1>
        <p className="mt-1 text-sm opacity-80">Attrazioni, consigli e trasporti nella zona</p>
      </div>

      <div className="space-y-6 px-4 pt-4">
        {attractions.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">
            Nessuna informazione disponibile al momento
          </p>
        ) : (
          sortedCategories.map((cat) => {
            const config = CATEGORY_CONFIG[cat] ?? CATEGORY_CONFIG.attraction
            const Icon = config.icon

            return (
              <div key={cat}>
                <div className="mb-3 flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full ${config.color}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {config.label}
                  </h2>
                </div>
                <div className="space-y-3">
                  {grouped.get(cat)!.map((item) => (
                    <Card key={item.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{item.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {item.description && (
                          <p className="text-sm text-muted-foreground">
                            {item.description}
                          </p>
                        )}
                        {item.external_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={item.external_url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-3.5 w-3.5" />
                              {cat === "transport" ? "Vedi Orari" : "Apri Link"}
                            </a>
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>

      <BottomNav />
    </div>
  )
}
