import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const SERPAPI_KEY = process.env.SERPAPI_KEY
const SCRAPING_WEEKLY_LIMIT = 4

// Fetch prices from SerpAPI Google Hotels for a competitor
async function fetchHotelPrices(
  hotelName: string,
  location: string | null,
  checkIn: string,   // YYYY-MM-DD
  checkOut: string   // YYYY-MM-DD
): Promise<{ price: number | null; availability: string; room_type?: string }> {
  if (!SERPAPI_KEY) {
    throw new Error("SERPAPI_KEY non configurata")
  }

  const query = location ? `${hotelName} ${location}` : hotelName
  const params = new URLSearchParams({
    engine: "google_hotels",
    q: query,
    check_in_date: checkIn,
    check_out_date: checkOut,
    adults: "2",
    currency: "EUR",
    gl: "it",
    hl: "it",
    api_key: SERPAPI_KEY,
  })

  const res = await fetch(`https://serpapi.com/search.json?${params}`, {
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`SerpAPI error: ${res.status}`)
  }

  const data = await res.json()

  // SerpAPI returns two different formats:
  // 1. Search results: data.properties[] array (multiple hotels)
  // 2. Property detail: data.rate_per_night at root level (when hotel found directly)
  const properties = data.properties ?? []

  if (properties.length === 0) {
    // Property-detail format: price is at root level
    const price = data.rate_per_night?.extracted_lowest
      ?? (data.prices?.[0]?.rate_per_night?.extracted_lowest ?? null)

    return {
      price: typeof price === "number" ? price : null,
      availability: price ? "Available" : "NotFound",
      room_type: undefined,
    }
  }

  // Standard search format: find best match in properties list
  const nameLower = hotelName.toLowerCase()
  const match = properties.find((p: { name: string }) =>
    p.name?.toLowerCase().includes(nameLower.split(" ")[0])
  ) ?? properties[0]

  const rawPrice = match.rate_per_night?.extracted_lowest
    ?? (match.rate_per_night?.lowest
      ? parseFloat(String(match.rate_per_night.lowest).replace(/[^0-9.]/g, ""))
      : null)

  const price = typeof rawPrice === "number" ? rawPrice : null
  const roomType = match.room_highlights?.[0]?.highlighted_items?.[0] ?? undefined

  return {
    price,
    availability: price ? "Available" : "SoldOut",
    room_type: typeof roomType === "string" ? roomType : undefined,
  }
}

// Generate date range YYYY-MM-DD array
function dateRange(startDate: string, days: number): string[] {
  const result: string[] = []
  const [y, m, d] = startDate.split("-").map(Number)
  for (let i = 0; i < days; i++) {
    const utc = new Date(Date.UTC(y, m - 1, d + i))
    result.push(utc.toISOString().split("T")[0])
  }
  return result
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()

    // Auth check
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
    }

    const body = await req.json()
    const { competitor_id, days = 14 } = body

    if (!competitor_id) {
      return NextResponse.json({ error: "competitor_id mancante" }, { status: 400 })
    }

    // Fetch competitor
    const { data: competitor, error: compError } = await supabase
      .from("competitor_structures")
      .select("*")
      .eq("id", competitor_id)
      .single()

    if (compError || !competitor) {
      return NextResponse.json({ error: "Competitor non trovato" }, { status: 404 })
    }

    if (!SERPAPI_KEY) {
      return NextResponse.json(
        { error: "SERPAPI_KEY non configurata. Aggiungila in .env.local" },
        { status: 500 }
      )
    }

    // ── Rate limit: 4 scansioni/settimana per property ─────────────────────
    // Trova property dell'utente + tutti i competitor della property
    const { data: profile } = await supabase
      .from("profiles")
      .select("property_id")
      .eq("id", user.id)
      .single()

    if (!profile?.property_id) {
      return NextResponse.json({ error: "Property non trovata" }, { status: 403 })
    }

    const { data: propCompetitors } = await supabase
      .from("competitor_structures")
      .select("id")
      .eq("property_id", profile.property_id)

    const propCompIds = (propCompetitors ?? []).map(c => c.id)

    if (propCompIds.length > 0) {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
      const { data: recentPrices } = await supabase
        .from("competitor_prices")
        .select("scraped_at")
        .in("competitor_id", propCompIds)
        .gte("scraped_at", weekAgo)

      // Raggruppa per secondo (una scansione = 1 timestamp condiviso da tutti i record)
      const distinctScrapes = new Set(
        (recentPrices ?? []).map(r => (r.scraped_at as string | null)?.slice(0, 19))
      )
      distinctScrapes.delete(undefined)

      if (distinctScrapes.size >= SCRAPING_WEEKLY_LIMIT) {
        const firstTs = [...distinctScrapes].sort()[0]
        const resetsAt = firstTs
          ? new Date(new Date(firstTs).getTime() + 7 * 86400000).toISOString()
          : null
        return NextResponse.json({
          error: `Limite settimanale raggiunto (${SCRAPING_WEEKLY_LIMIT} scansioni/settimana). La quota si sblocca gradualmente.`,
          limit: SCRAPING_WEEKLY_LIMIT,
          used: distinctScrapes.size,
          resetsAt,
        }, { status: 429 })
      }
    }

    // Scrape prices for next N days (1 night stays)
    const today = new Date().toISOString().split("T")[0]
    const dates = dateRange(today, days)

    const results: Array<{
      date: string
      price: number | null
      room_type_scraped: string | null
      availability_status: string
    }> = []

    // Batch requests: SerpAPI allows concurrent calls, but we throttle to be safe
    // Process in batches of 3 concurrent requests
    const batchSize = 3
    for (let i = 0; i < dates.length; i += batchSize) {
      const batch = dates.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(async (date) => {
          // check_out = date + 1
          const [cy, cm, cd] = date.split("-").map(Number)
          const checkOut = new Date(Date.UTC(cy, cm - 1, cd + 1))
            .toISOString()
            .split("T")[0]

          try {
            const result = await fetchHotelPrices(
              competitor.name,
              competitor.location,
              date,
              checkOut
            )
            return {
              date,
              price: result.price,
              room_type_scraped: result.room_type ?? null,
              availability_status: result.availability,
            }
          } catch {
            return {
              date,
              price: null,
              room_type_scraped: null,
              availability_status: "Error",
            }
          }
        })
      )
      results.push(...batchResults)
    }

    // Upsert into competitor_prices — shared timestamp così il rate-limit conta
    // questa come UNA scansione (tutti i record hanno stesso scraped_at al secondo)
    const scrapedAt = new Date().toISOString()
    const rows = results.map((r) => ({
      competitor_id,
      date: r.date,
      price: r.price,
      room_type_scraped: r.room_type_scraped,
      availability_status: r.availability_status,
      scraped_at: scrapedAt,
    }))

    const { error: upsertError } = await supabase
      .from("competitor_prices")
      .upsert(rows, { onConflict: "competitor_id,date,room_type_scraped" })

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 })
    }

    const found = results.filter((r) => r.price !== null).length

    return NextResponse.json({
      success: true,
      scraped: results.length,
      found,
      competitor: competitor.name,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Errore sconosciuto"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
