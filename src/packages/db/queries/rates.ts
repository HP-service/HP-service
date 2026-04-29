"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"

// ─── Internal helper ──────────────────────────────────────────────────────────

async function getPropertyId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("profiles")
    .select("property_id")
    .eq("id", user.id)
    .single()
  return data?.property_id ?? null
}

// ─── Daily Rates ──────────────────────────────────────────────────────────────

export async function getDailyRatesRange(from: string, to: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("daily_rates")
    .select("room_type_id, date, price, is_closed")
    .gte("date", from)
    .lte("date", to)
    .order("date")

  if (error) return failure(error.message)
  return success(data)
}

export async function upsertDailyRate(
  roomTypeId: string,
  date: string,
  price: number
): Promise<ActionResult> {
  const supabase = await createClient()
  const propertyId = await getPropertyId()
  if (!propertyId) return failure("Proprietà non trovata")

  const { error } = await supabase
    .from("daily_rates")
    .upsert(
      { property_id: propertyId, room_type_id: roomTypeId, date, price, is_closed: false },
      { onConflict: "property_id,room_type_id,date" }
    )
  if (error) return failure(error.message)
  revalidatePath("/rates")
  revalidatePath("/scraping")
  return success(undefined)
}

export async function upsertDailyRatesBulk(
  rows: Array<{ room_type_id: string; date: string; price: number }>
): Promise<ActionResult> {
  const supabase = await createClient()
  const propertyId = await getPropertyId()
  if (!propertyId) return failure("Proprietà non trovata")

  const { error } = await supabase
    .from("daily_rates")
    .upsert(
      rows.map((r) => ({ property_id: propertyId, ...r, is_closed: false })),
      { onConflict: "property_id,room_type_id,date" }
    )
  if (error) return failure(error.message)
  revalidatePath("/rates")
  revalidatePath("/scraping")
  return success(undefined)
}

export async function setDatesClosed(
  roomTypeId: string,
  dates: string[],
  isClosed: boolean
): Promise<ActionResult> {
  const supabase = await createClient()
  const propertyId = await getPropertyId()
  if (!propertyId) return failure("Proprietà non trovata")

  const rows = dates.map((d) => ({
    property_id: propertyId,
    room_type_id: roomTypeId,
    date: d,
    is_closed: isClosed,
    // price is required in schema — set a placeholder; RLS/trigger should handle it
    // We use an update instead to preserve existing price
  }))

  // Use update for existing rows, insert only if not exists
  for (const row of rows) {
    const { error: updateErr, count } = await supabase
      .from("daily_rates")
      .update({ is_closed: isClosed })
      .eq("property_id", propertyId)
      .eq("room_type_id", roomTypeId)
      .eq("date", row.date)

    if (updateErr) return failure(updateErr.message)

    // If no row was updated, insert with a dummy price (0) — closed means not bookable anyway
    if (count === 0) {
      const { error: insertErr } = await supabase
        .from("daily_rates")
        .insert({ property_id: propertyId, room_type_id: roomTypeId, date: row.date, is_closed: isClosed, price: 0 })
      if (insertErr) return failure(insertErr.message)
    }
  }

  revalidatePath("/rates")
  return success(undefined)
}

export async function setBulkPrice(
  roomTypeId: string,
  dates: string[],
  price: number
): Promise<ActionResult> {
  const supabase = await createClient()
  const propertyId = await getPropertyId()
  if (!propertyId) return failure("Proprietà non trovata")

  const rows = dates.map((d) => ({
    property_id: propertyId,
    room_type_id: roomTypeId,
    date: d,
    price,
    is_closed: false,
  }))
  const { error } = await supabase
    .from("daily_rates")
    .upsert(rows, { onConflict: "property_id,room_type_id,date" })
  if (error) return failure(error.message)
  revalidatePath("/rates")
  return success(undefined)
}

// ─── Occupancy ────────────────────────────────────────────────────────────────

export async function getOccupancyData(from: string, to: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      id,
      check_in,
      check_out,
      status,
      booking_rooms (
        room_id,
        rooms:room_id (
          id,
          room_type_assignments (
            room_type_id,
            is_active
          )
        )
      )
    `)
    .lt("check_in", to)
    .gt("check_out", from)
    .not("status", "in", '("cancelled","no_show")')

  if (error) return failure(error.message)
  return success(data)
}

export async function getRoomCountsByType() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("room_type_assignments")
    .select("room_type_id")
    .eq("is_active", true)

  if (error) return failure(error.message)

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    counts[row.room_type_id] = (counts[row.room_type_id] ?? 0) + 1
  }
  return success(counts)
}
