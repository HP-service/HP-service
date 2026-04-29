"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus, Trash2, RefreshCw, ExternalLink, Star,
  TrendingUp, TrendingDown, Minus, AlertCircle, Zap,
} from "lucide-react"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { createCompetitor, deleteCompetitor } from "@db/queries/scraping"

// ─── Types ────────────────────────────────────────────────────────────────────

type Competitor = {
  id: string
  name: string
  platform: string | null
  url: string | null
  location: string | null
  stars: number | null
  notes: string | null
}

type PriceRow = {
  id: string
  competitor_id: string
  date: string
  price: number | null
  room_type_scraped: string | null
  availability_status: string | null
  scraped_at: string
  competitor: { id: string; name: string; platform: string | null; stars: number | null } | null
}

type Quota = {
  used: number
  limit: number
  remaining: number
  resetsAt: string | null
}

type Props = {
  competitors: Competitor[]
  prices: PriceRow[]
  propertyId: string
  hasSerpApiKey: boolean
  quota: Quota
}

const PLATFORMS = ["Booking.com", "Airbnb", "Expedia", "TripAdvisor", "Diretto", "Altro"]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("it-IT", { day: "2-digit", month: "short" })
}

// Get next N days
function getNextDays(n: number): string[] {
  const days: string[] = []
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.now() + i * 86400000)
    days.push(d.toISOString().split("T")[0])
  }
  return days
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ScrapingClient({ competitors, prices, propertyId, hasSerpApiKey, quota }: Props) {
  const quotaExhausted = quota.remaining <= 0
  const quotaPct = Math.min(100, Math.round((quota.used / quota.limit) * 100))
  const resetLabel = quota.resetsAt
    ? new Date(quota.resetsAt).toLocaleDateString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : null
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showCreate, setShowCreate] = useState(false)
  const [scrapingId, setScrapingId] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState<"7" | "14" | "30">("14")

  const [form, setForm] = useState({
    name: "",
    platform: "",
    url: "",
    location: "",
    stars: "",
    notes: "",
  })

  // ── Build price grid ───────────────────────────────────────────────────────
  const days = getNextDays(parseInt(selectedDays))

  // Build price map: { competitor_id: { date: price } }
  const priceMap: Record<string, Record<string, number | null>> = {}
  for (const p of prices) {
    if (!priceMap[p.competitor_id]) priceMap[p.competitor_id] = {}
    if (p.date in priceMap[p.competitor_id]) {
      // Keep lowest price for the day
      const existing = priceMap[p.competitor_id][p.date]
      if (existing === null || (p.price !== null && p.price < existing)) {
        priceMap[p.competitor_id][p.date] = p.price
      }
    } else {
      priceMap[p.competitor_id][p.date] = p.price
    }
  }

  // ── Create competitor ──────────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name) { toast.error("Inserisci il nome del competitor"); return }

    startTransition(async () => {
      const result = await createCompetitor(propertyId, {
        name: form.name,
        platform: form.platform || undefined,
        url: form.url || undefined,
        location: form.location || undefined,
        stars: form.stars ? parseInt(form.stars) : undefined,
        notes: form.notes || undefined,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Competitor aggiunto")
        setShowCreate(false)
        setForm({ name: "", platform: "", url: "", location: "", stars: "", notes: "" })
        router.refresh()
      }
    })
  }

  // ── Delete competitor ──────────────────────────────────────────────────────
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Rimuovere "${name}" dai competitor?`)) return
    startTransition(async () => {
      const result = await deleteCompetitor(id)
      if (result.error) toast.error(result.error)
      else { toast.success("Competitor rimosso"); router.refresh() }
    })
  }

  // ── Scrape prices ──────────────────────────────────────────────────────────
  async function handleScrape(competitorId: string, competitorName: string) {
    if (!hasSerpApiKey) {
      toast.error("Aggiungi SERPAPI_KEY in .env.local per usare lo scraping automatico")
      return
    }
    if (quotaExhausted) {
      toast.error(
        `Limite settimanale raggiunto (${quota.limit}/sett.)${resetLabel ? ` · Si sblocca il ${resetLabel}` : ""}`
      )
      return
    }

    setScrapingId(competitorId)
    try {
      const res = await fetch("/api/scraping/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitor_id: competitorId, days: parseInt(selectedDays) }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Errore scraping")
      } else {
        toast.success(`${competitorName}: trovati ${data.found}/${data.scraped} prezzi`)
        router.refresh()
      }
    } catch {
      toast.error("Errore di rete")
    } finally {
      setScrapingId(null)
    }
  }

  // ── Scrape all ─────────────────────────────────────────────────────────────
  async function handleScrapeAll() {
    if (!hasSerpApiKey) {
      toast.error("Aggiungi SERPAPI_KEY in .env.local")
      return
    }
    for (const c of competitors) {
      await handleScrape(c.id, c.name)
    }
  }

  // ── Price cell color ───────────────────────────────────────────────────────
  function priceColor(price: number | null, allPricesForDay: (number | null)[]): string {
    if (price === null) return "text-muted-foreground"
    const valid = allPricesForDay.filter((p): p is number => p !== null)
    if (valid.length < 2) return "text-foreground"
    const min = Math.min(...valid)
    const max = Math.max(...valid)
    if (price === min) return "text-emerald-600 font-semibold"
    if (price === max) return "text-red-500 font-semibold"
    return "text-foreground"
  }

  return (
    <div className="space-y-6">
      {/* Quota indicator */}
      <Card className={quotaExhausted ? "border-amber-300 bg-amber-50/50" : ""}>
        <CardContent className="py-3 px-4 flex items-center gap-3">
          <Zap className={`h-4 w-4 shrink-0 ${quotaExhausted ? "text-amber-600" : "text-emerald-600"}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium">
                Quota scansioni settimanali
              </span>
              <span className={`text-sm tabular-nums ${quotaExhausted ? "text-amber-700 font-semibold" : "text-muted-foreground"}`}>
                {quota.used} / {quota.limit}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all ${quotaExhausted ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${quotaPct}%` }}
              />
            </div>
            {quotaExhausted && resetLabel && (
              <p className="text-xs text-amber-700 mt-1">
                Limite raggiunto. Prossima scansione disponibile dal {resetLabel}.
              </p>
            )}
            {!quotaExhausted && (
              <p className="text-xs text-muted-foreground mt-1">
                {quota.remaining} {quota.remaining === 1 ? "scansione rimanente" : "scansioni rimanenti"} questa settimana.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* API key warning */}
      {!hasSerpApiKey && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-amber-800">SerpAPI non configurata</p>
            <p className="text-amber-700 mt-0.5">
              Per lo scraping automatico dei prezzi, aggiungi <code className="bg-amber-100 px-1 rounded">SERPAPI_KEY=la_tua_chiave</code> in{" "}
              <code className="bg-amber-100 px-1 rounded">.env.local</code>.
              Registrati gratis su{" "}
              <a href="https://serpapi.com" target="_blank" rel="noopener noreferrer" className="underline">serpapi.com</a>{" "}
              (100 ricerche/mese gratuite).
            </p>
          </div>
        </div>
      )}

      {/* Competitor list */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Strutture monitorate</CardTitle>
            <div className="flex items-center gap-2">
              {competitors.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleScrapeAll}
                  disabled={isPending || scrapingId !== null || quotaExhausted}
                  title={quotaExhausted ? "Limite settimanale raggiunto" : undefined}
                >
                  <RefreshCw className={`h-3.5 w-3.5 mr-1 ${scrapingId !== null ? "animate-spin" : ""}`} />
                  Aggiorna tutti
                </Button>
              )}
              <Button size="sm" onClick={() => setShowCreate(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Aggiungi
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {competitors.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nessun competitor aggiunto. Clicca "Aggiungi" per iniziare il monitoraggio.
            </p>
          ) : (
            <div className="space-y-2">
              {competitors.map((c) => {
                const isLoading = scrapingId === c.id
                // Get latest price (today or tomorrow)
                const todayPrice = priceMap[c.id]?.[days[0]] ?? null
                const priceCount = Object.values(priceMap[c.id] ?? {}).filter(p => p !== null).length

                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{c.name}</span>
                        {c.stars && (
                          <span className="flex items-center gap-0.5 text-amber-500 text-xs">
                            {Array.from({ length: c.stars }).map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-current" />
                            ))}
                          </span>
                        )}
                        {c.platform && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{c.platform}</span>
                        )}
                      </div>
                      {c.location && (
                        <p className="text-xs text-muted-foreground mt-0.5">{c.location}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {priceCount > 0 ? `${priceCount} prezzi caricati` : "Nessun prezzo — clicca Aggiorna"}
                        {todayPrice !== null && ` · Stasera: €${Math.round(todayPrice)}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Apri pagina"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => handleScrape(c.id, c.name)}
                        disabled={isLoading || scrapingId !== null || quotaExhausted}
                        title={quotaExhausted ? "Limite settimanale raggiunto" : undefined}
                      >
                        <RefreshCw className={`h-3 w-3 mr-1 ${isLoading ? "animate-spin" : ""}`} />
                        {isLoading ? "Scraping..." : "Aggiorna"}
                      </Button>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={isPending}
                        className="p-1.5 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Price comparison grid */}
      {competitors.length > 0 && Object.keys(priceMap).length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Confronto prezzi</CardTitle>
              <div className="flex items-center gap-1.5">
                {(["7", "14", "30"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setSelectedDays(d)}
                    className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                      selectedDays === d
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {d}gg
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground sticky left-0 bg-muted/30 min-w-[140px]">
                      Struttura
                    </th>
                    {days.map((d) => (
                      <th key={d} className="px-2 py-2.5 text-center font-medium text-muted-foreground whitespace-nowrap min-w-[60px]">
                        {formatDate(d)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {competitors.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/10">
                      <td className="px-3 py-2.5 font-medium sticky left-0 bg-background">
                        {c.name}
                        {c.stars && <span className="text-amber-500 ml-1">{"★".repeat(c.stars)}</span>}
                      </td>
                      {days.map((date) => {
                        const price = priceMap[c.id]?.[date] ?? null
                        const allForDay = competitors.map(comp => priceMap[comp.id]?.[date] ?? null)
                        const colorClass = priceColor(price, allForDay)

                        return (
                          <td key={date} className="px-2 py-2.5 text-center">
                            {price !== null ? (
                              <span className={colorClass}>
                                €{Math.round(price)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-3 py-2 border-t text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <TrendingDown className="h-3 w-3 text-emerald-600" />
                <span className="text-emerald-600">Prezzo più basso</span>
              </span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-red-500" />
                <span className="text-red-500">Prezzo più alto</span>
              </span>
              <span className="flex items-center gap-1">
                <Minus className="h-3 w-3" />
                Nessun dato
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add competitor dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aggiungi Competitor</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome struttura *</Label>
              <Input
                placeholder="es. Hotel Belvedere"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                className="h-8 text-sm"
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Piattaforma</Label>
                <Select value={form.platform} onValueChange={(v) => setForm(f => ({ ...f, platform: v }))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Seleziona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stelle</Label>
                <Select value={form.stars} onValueChange={(v) => setForm(f => ({ ...f, stars: v }))}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="—" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(s => (
                      <SelectItem key={s} value={String(s)}>{"★".repeat(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Località (es. "Amalfi, SA")</Label>
              <Input
                placeholder="es. Positano, Salerno"
                value={form.location}
                onChange={(e) => setForm(f => ({ ...f, location: e.target.value }))}
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Usata per affinare la ricerca su Google Hotels
              </p>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">URL pagina (opzionale)</Label>
              <Input
                placeholder="https://www.booking.com/hotel/..."
                value={form.url}
                onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Note</Label>
              <Input
                placeholder="Note interne..."
                value={form.notes}
                onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button type="submit" size="sm" className="flex-1" disabled={isPending}>
                {isPending ? "Salvataggio..." : "Aggiungi"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                Annulla
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
