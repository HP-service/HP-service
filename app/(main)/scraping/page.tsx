export const dynamic = "force-dynamic"

import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import { getCompetitors, getAllRecentPrices, getScrapingQuota } from "@db/queries/scraping"
import { TrendingUp } from "lucide-react"
import { ScrapingClient } from "./_components/scraping-client"

export default async function ScrapingPage() {
  const profile = await requireRole(MAIN_APP_ROLES)

  const [competitorsResult, pricesResult, quota] = await Promise.all([
    getCompetitors(),
    getAllRecentPrices(30),
    getScrapingQuota(),
  ])

  const competitors = competitorsResult.data ?? []
  const prices = pricesResult.data ?? []
  const hasSerpApiKey = !!process.env.SERPAPI_KEY

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <TrendingUp className="h-7 w-7 text-muted-foreground" />
          Competitor
        </h1>
        <p className="text-muted-foreground mt-0.5">
          Monitora i prezzi delle strutture concorrenti via Google Hotels (SerpAPI)
        </p>
      </div>

      <ScrapingClient
        competitors={competitors}
        prices={prices as Parameters<typeof ScrapingClient>[0]["prices"]}
        propertyId={profile.property_id!}
        hasSerpApiKey={hasSerpApiKey}
        quota={quota}
      />
    </div>
  )
}
