"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"

// ─── Competitors CRUD ─────────────────────────────────────────────────────────

export async function getCompetitors() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("competitor_structures")
    .select("*")
    .eq("is_active", true)
    .order("name")

  if (error) return failure(error.message)
  return success(data)
}

export async function createCompetitor(
  propertyId: string,
  values: {
    name: string
    platform?: string
    url?: string
    location?: string
    stars?: number
    notes?: string
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("competitor_structures")
    .insert({ property_id: propertyId, ...values })

  if (error) return failure(error.message)
  revalidatePath("/scraping")
  return success(undefined)
}

export async function updateCompetitor(
  id: string,
  values: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("competitor_structures")
    .update(values)
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/scraping")
  return success(undefined)
}

export async function deleteCompetitor(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("competitor_structures")
    .update({ is_active: false })
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/scraping")
  return success(undefined)
}

// ─── Prices ───────────────────────────────────────────────────────────────────

export async function getCompetitorPrices(
  competitorId: string,
  days: number = 30
) {
  const supabase = await createClient()
  const from = new Date().toISOString().split("T")[0]
  const to = new Date(Date.now() + days * 86400000).toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("competitor_prices")
    .select("*")
    .eq("competitor_id", competitorId)
    .gte("date", from)
    .lte("date", to)
    .order("date")

  if (error) return failure(error.message)
  return success(data)
}

export async function getAllRecentPrices(days: number = 14) {
  const supabase = await createClient()
  const from = new Date().toISOString().split("T")[0]
  const to = new Date(Date.now() + days * 86400000).toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("competitor_prices")
    .select(`
      *,
      competitor:competitor_id (id, name, platform, stars)
    `)
    .gte("date", from)
    .lte("date", to)
    .order("date")

  if (error) return failure(error.message)
  return success(data)
}

// ─── Rate Limit Quota ─────────────────────────────────────────────────────────

const SCRAPING_WEEKLY_LIMIT = 4

/**
 * Conta quante scansioni sono state fatte negli ultimi 7 giorni per la property
 * dell'utente. Ogni scansione = una chiamata POST /api/scraping/prices (tutti i
 * record di quella chiamata hanno lo stesso `scraped_at` timestamp).
 */
export async function getScrapingQuota(): Promise<{
  used: number
  limit: number
  remaining: number
  resetsAt: string | null
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { used: 0, limit: SCRAPING_WEEKLY_LIMIT, remaining: SCRAPING_WEEKLY_LIMIT, resetsAt: null }

  const { data: profile } = await supabase
    .from("profiles")
    .select("property_id")
    .eq("id", user.id)
    .single()

  if (!profile?.property_id) {
    return { used: 0, limit: SCRAPING_WEEKLY_LIMIT, remaining: SCRAPING_WEEKLY_LIMIT, resetsAt: null }
  }

  // Get competitor IDs for this property
  const { data: competitors } = await supabase
    .from("competitor_structures")
    .select("id")
    .eq("property_id", profile.property_id)

  const competitorIds = (competitors ?? []).map(c => c.id)
  if (competitorIds.length === 0) {
    return { used: 0, limit: SCRAPING_WEEKLY_LIMIT, remaining: SCRAPING_WEEKLY_LIMIT, resetsAt: null }
  }

  // Timestamp 7 giorni fa
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

  const { data: recentPrices } = await supabase
    .from("competitor_prices")
    .select("scraped_at")
    .in("competitor_id", competitorIds)
    .gte("scraped_at", weekAgo)
    .order("scraped_at", { ascending: true })

  // Raggruppa per secondo (tutti i record di una scansione hanno stesso timestamp)
  const distinctTimestamps = new Set(
    (recentPrices ?? []).map(r => (r.scraped_at as string | null)?.slice(0, 19))
  )
  distinctTimestamps.delete(undefined)

  const used = distinctTimestamps.size
  const remaining = Math.max(0, SCRAPING_WEEKLY_LIMIT - used)

  // Reset = primo scraping registrato + 7 giorni (quando scade dall'elenco)
  let resetsAt: string | null = null
  if (used > 0 && remaining === 0) {
    const firstTimestamp = [...distinctTimestamps].sort()[0]
    if (firstTimestamp) {
      const d = new Date(firstTimestamp)
      d.setDate(d.getDate() + 7)
      resetsAt = d.toISOString()
    }
  }

  return { used, limit: SCRAPING_WEEKLY_LIMIT, remaining, resetsAt }
}

export async function getDailyRatesForAnalysis(days: number = 30) {
  const supabase = await createClient()
  const from = new Date().toISOString().split("T")[0]
  const to = new Date(Date.now() + days * 86400000).toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("daily_rates")
    .select("room_type_id, date, price, is_closed")
    .gte("date", from)
    .lte("date", to)
    .order("date")

  if (error) return failure(error.message)
  return success(data)
}

// ─── Daily Rates Upsert ───────────────────────────────────────────────────────

async function getPropertyId(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from("profiles").select("property_id").eq("id", user.id).single()
  return data?.property_id ?? null
}

export async function upsertDailyRate(
  roomTypeId: string,
  date: string,
  price: number
): Promise<ActionResult> {
  const supabase = await createClient()
  const propertyId = await getPropertyId(supabase)
  if (!propertyId) return failure("Proprietà non trovata")
  const { error } = await supabase
    .from("daily_rates")
    .upsert(
      { property_id: propertyId, room_type_id: roomTypeId, date, price, is_closed: false },
      { onConflict: "property_id,room_type_id,date" }
    )
  if (error) return failure(error.message)
  revalidatePath("/scraping")
  revalidatePath("/rates")
  return success(undefined)
}

export async function upsertDailyRatesBulk(
  rows: Array<{ room_type_id: string; date: string; price: number }>
): Promise<ActionResult> {
  const supabase = await createClient()
  const propertyId = await getPropertyId(supabase)
  if (!propertyId) return failure("Proprietà non trovata")
  const { error } = await supabase
    .from("daily_rates")
    .upsert(
      rows.map((r) => ({ property_id: propertyId, ...r, is_closed: false })),
      { onConflict: "property_id,room_type_id,date" }
    )
  if (error) return failure(error.message)
  revalidatePath("/scraping")
  revalidatePath("/rates")
  return success(undefined)
}

export async function saveCompetitorPrices(
  competitorId: string,
  prices: Array<{
    date: string
    price: number | null
    room_type_scraped?: string
    availability_status?: string
  }>
): Promise<ActionResult> {
  const supabase = await createClient()

  const rows = prices.map((p) => ({
    competitor_id: competitorId,
    date: p.date,
    price: p.price,
    room_type_scraped: p.room_type_scraped ?? null,
    availability_status: p.availability_status ?? "Available",
    scraped_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from("competitor_prices")
    .upsert(rows, { onConflict: "competitor_id,date,room_type_scraped" })

  if (error) return failure(error.message)
  revalidatePath("/scraping")
  return success(undefined)
}
