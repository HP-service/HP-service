"use server"

import { createClient } from "@/lib/supabase/server"
import { success, failure, type ActionResult } from "@utils/errors"

// ============================================
// Types
// ============================================

export type RevenueMetrics = {
  startDate: string
  endDate: string
  totalDays: number
  totalRooms: number
  availableRoomNights: number
  occupiedRoomNights: number
  occupancy: number // 0..1
  revenue: number
  adr: number // Average Daily Rate
  revpar: number // Revenue Per Available Room
}

export type ForecastPoint = {
  month: string // YYYY-MM
  label: string
  revenue: number
  occupiedNights: number
  availableNights: number
  occupancy: number
  adr: number
  revpar: number
}

export type ChannelBreakdown = {
  channel: string
  bookings: number
  revenue: number
  nights: number
  pct: number
}

// ============================================
// Helpers
// ============================================

function daysBetween(a: string, b: string): number {
  const start = new Date(a + "T00:00:00")
  const end = new Date(b + "T00:00:00")
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000))
}

function overlapNights(checkIn: string, checkOut: string, periodStart: string, periodEnd: string): number {
  const a = new Date(Math.max(new Date(checkIn).getTime(), new Date(periodStart).getTime()))
  const b = new Date(Math.min(new Date(checkOut).getTime(), new Date(periodEnd).getTime()))
  const diff = (b.getTime() - a.getTime()) / 86400000
  return Math.max(0, Math.round(diff))
}

async function getRoomCount(supabase: Awaited<ReturnType<typeof createClient>>, propertyId: string): Promise<number> {
  const { count } = await supabase
    .from("rooms")
    .select("id", { count: "exact", head: true })
    .eq("property_id", propertyId)
    .neq("status", "OutOfOrder")
  return count ?? 0
}

async function getCurrentPropertyId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("property_id")
    .eq("id", user.id)
    .single()
  return profile?.property_id ?? null
}

// ============================================
// Revenue Metrics for arbitrary period
// ============================================

export async function getRevenueMetrics(
  startDate: string,
  endDate: string
): Promise<ActionResult<RevenueMetrics>> {
  const supabase = await createClient()
  const propertyId = await getCurrentPropertyId()
  if (!propertyId) return failure("Property non trovata")

  const totalRooms = await getRoomCount(supabase, propertyId)
  const totalDays = daysBetween(startDate, endDate)
  const availableRoomNights = totalRooms * totalDays

  // Bookings overlapping the period (exclude Cancelled and NoShow)
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("check_in, check_out, total_amount, nights, status")
    .eq("property_id", propertyId)
    .lt("check_in", endDate)
    .gt("check_out", startDate)
    .not("status", "in", "(Cancelled,NoShow)")

  if (error) return failure(error.message)

  let occupiedRoomNights = 0
  let revenue = 0

  for (const b of bookings ?? []) {
    const overlap = overlapNights(b.check_in, b.check_out, startDate, endDate)
    occupiedRoomNights += overlap
    // Revenue pro-rata su notti effettive nel periodo
    const totalNights = b.nights ?? daysBetween(b.check_in, b.check_out)
    const totalAmount = Number(b.total_amount ?? 0)
    if (totalNights > 0) {
      revenue += (totalAmount / totalNights) * overlap
    }
  }

  const occupancy = availableRoomNights > 0 ? occupiedRoomNights / availableRoomNights : 0
  const adr = occupiedRoomNights > 0 ? revenue / occupiedRoomNights : 0
  const revpar = availableRoomNights > 0 ? revenue / availableRoomNights : 0

  return success({
    startDate,
    endDate,
    totalDays,
    totalRooms,
    availableRoomNights,
    occupiedRoomNights,
    occupancy,
    revenue,
    adr,
    revpar,
  })
}

// ============================================
// Forecast 90 days (next 3 months) — also works for past months
// ============================================

export async function getForecast90Days(): Promise<ActionResult<ForecastPoint[]>> {
  const supabase = await createClient()
  const propertyId = await getCurrentPropertyId()
  if (!propertyId) return failure("Property non trovata")

  const totalRooms = await getRoomCount(supabase, propertyId)
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Next 3 months (rolling 90 giorni grouped per month)
  const months: { month: string; label: string; start: Date; end: Date }[] = []
  for (let i = 0; i < 3; i++) {
    const start = new Date(today.getFullYear(), today.getMonth() + i, 1)
    const end = new Date(today.getFullYear(), today.getMonth() + i + 1, 0)
    months.push({
      month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
      label: start.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
      start,
      end,
    })
  }

  const overallStart = months[0].start.toISOString().split("T")[0]
  const overallEnd = new Date(months[months.length - 1].end.getTime() + 86400000)
    .toISOString()
    .split("T")[0]

  const { data: bookings, error } = await supabase
    .from("bookings")
    .select("check_in, check_out, total_amount, nights, status")
    .eq("property_id", propertyId)
    .lt("check_in", overallEnd)
    .gt("check_out", overallStart)
    .not("status", "in", "(Cancelled,NoShow)")

  if (error) return failure(error.message)

  const result: ForecastPoint[] = months.map((m) => {
    const periodStart = m.start.toISOString().split("T")[0]
    const periodEnd = new Date(m.end.getTime() + 86400000).toISOString().split("T")[0]
    const totalDays = daysBetween(periodStart, periodEnd)
    const availableNights = totalRooms * totalDays

    let occupiedNights = 0
    let revenue = 0

    for (const b of bookings ?? []) {
      const overlap = overlapNights(b.check_in, b.check_out, periodStart, periodEnd)
      if (overlap === 0) continue
      occupiedNights += overlap
      const totalNights = b.nights ?? daysBetween(b.check_in, b.check_out)
      const amt = Number(b.total_amount ?? 0)
      if (totalNights > 0) revenue += (amt / totalNights) * overlap
    }

    const occupancy = availableNights > 0 ? occupiedNights / availableNights : 0
    const adr = occupiedNights > 0 ? revenue / occupiedNights : 0
    const revpar = availableNights > 0 ? revenue / availableNights : 0

    return {
      month: m.month,
      label: m.label,
      revenue: Math.round(revenue),
      occupiedNights,
      availableNights,
      occupancy,
      adr: Math.round(adr),
      revpar: Math.round(revpar),
    }
  })

  return success(result)
}

// ============================================
// YoY comparison for current month
// ============================================

export async function getYoYComparison(month: string): Promise<
  ActionResult<{ current: RevenueMetrics; previous: RevenueMetrics }>
> {
  const [year, m] = month.split("-").map(Number)
  const startCurrent = `${year}-${String(m).padStart(2, "0")}-01`
  const endCurrent = new Date(year, m, 0).toISOString().split("T")[0]
  const startPrev = `${year - 1}-${String(m).padStart(2, "0")}-01`
  const endPrev = new Date(year - 1, m, 0).toISOString().split("T")[0]

  const [cur, prev] = await Promise.all([
    getRevenueMetrics(startCurrent, endCurrent),
    getRevenueMetrics(startPrev, endPrev),
  ])

  if (cur.error || !cur.data) return failure(cur.error ?? "Dati periodo corrente non disponibili")
  if (prev.error || !prev.data) return failure(prev.error ?? "Dati YoY non disponibili")

  return success({ current: cur.data, previous: prev.data })
}

// ============================================
// Channel breakdown for current month
// ============================================

export async function getChannelBreakdown(
  month: string
): Promise<ActionResult<ChannelBreakdown[]>> {
  const supabase = await createClient()
  const propertyId = await getCurrentPropertyId()
  if (!propertyId) return failure("Property non trovata")

  const [year, m] = month.split("-").map(Number)
  const startDate = `${year}-${String(m).padStart(2, "0")}-01`
  const endDate = new Date(year, m, 0).toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("bookings")
    .select("total_amount, nights, channel:channel_id(name)")
    .eq("property_id", propertyId)
    .gte("check_in", startDate)
    .lte("check_in", endDate)
    .not("status", "in", "(Cancelled,NoShow)")

  if (error) return failure(error.message)

  const map = new Map<string, { bookings: number; revenue: number; nights: number }>()
  for (const b of data ?? []) {
    const ch = b.channel as unknown as { name: string } | null
    const name = ch?.name || "Diretto"
    const cur = map.get(name) ?? { bookings: 0, revenue: 0, nights: 0 }
    cur.bookings++
    cur.revenue += Number(b.total_amount ?? 0)
    cur.nights += Number(b.nights ?? 0)
    map.set(name, cur)
  }

  const total = Array.from(map.values()).reduce((s, c) => s + c.revenue, 0)
  const result: ChannelBreakdown[] = Array.from(map.entries())
    .map(([channel, c]) => ({
      channel,
      bookings: c.bookings,
      revenue: c.revenue,
      nights: c.nights,
      pct: total > 0 ? c.revenue / total : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)

  return success(result)
}
