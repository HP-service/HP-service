export const dynamic = "force-dynamic"

import Link from "next/link"
import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import { getExpenses } from "@db/queries/finance"
import { getExpenseCategories } from "@db/queries/settings"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { ArrowLeft } from "lucide-react"
import { ExpensesClient } from "./_components/expenses-client"

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; category_id?: string }>
}) {
  const profile = await requireRole(MAIN_APP_ROLES)
  const filters = await searchParams

  const [expensesResult, categoriesResult] = await Promise.all([
    getExpenses(filters),
    getExpenseCategories(),
  ])

  const expenses = expensesResult.data ?? []
  const categories = categoriesResult.data ?? []

  // Totale filtrato
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  // Breakdown per categoria
  const byCategory: Record<string, { name: string; color: string | null; total: number }> = {}
  for (const e of expenses) {
    const cat = e.category as { id: string; name: string; color: string | null } | null
    if (!cat) continue
    if (!byCategory[cat.id]) byCategory[cat.id] = { name: cat.name, color: cat.color, total: 0 }
    byCategory[cat.id].total += Number(e.amount)
  }
  const categoryBreakdown = Object.values(byCategory).sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/finance" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Finance
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold tracking-tight">Spese</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: breakdown categorie */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Totale Filtrato</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">€{Math.round(total).toLocaleString("it-IT")}</p>
              <p className="text-sm text-muted-foreground mt-1">{expenses.length} spese</p>
            </CardContent>
          </Card>

          {categoryBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Per Categoria</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {cat.color && (
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                        )}
                        <span>{cat.name}</span>
                      </div>
                      <span className="font-medium">€{Math.round(cat.total).toLocaleString("it-IT")}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round((cat.total / total) * 100)}%`,
                          backgroundColor: cat.color ?? "#6b7280",
                        }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground text-right">
                      {Math.round((cat.total / total) * 100)}%
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: lista spese + form aggiunta */}
        <div className="lg:col-span-2">
          <ExpensesClient
            expenses={expenses}
            categories={categories}
            propertyId={profile.property_id!}
            currentFilters={filters}
          />
        </div>
      </div>
    </div>
  )
}
