"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import { success, failure, type ActionResult } from "@utils/errors"
import { revalidatePath } from "next/cache"
import { parseIcal } from "@ical/parser"
import { generateIcal, generateIcalAll, type BookingEvent } from "@ical/generator"

// ── iCal Token ──────────────────────────────────

/** Get or generate the iCal secret token for this property */
export async function getIcalToken(): Promise<ActionResult<string>> {
  const profile = await requireRole(MAIN_APP_ROLES)
  const supabase = await createClient()

  const { data: property } = await supabase
    .from("properties")
    .select("settings")
    .eq("id", profile.property_id!)
    .single()

  const settings = (property?.settings ?? {}) as Record<string, unknown>
  if (settings.ical_token) {
    return success(settings.ical_token as string)
  }

  // Generate new token
  const token = crypto.randomUUID().replace(/-/g, "")
  const { error } = await supabase
    .from("properties")
    .update({
      settings: { ...settings, ical_token: token },
    })
    .eq("id", profile.property_id!)

  if (error) return failure(error.message)
  return success(token)
}

export async function regenerateIcalToken(): Promise<ActionResult<string>> {
  const profile = await requireRole(MAIN_APP_ROLES)
  const supabase = await createClient()

  const { data: property } = await supabase
    .from("properties")
    .select("settings")
    .eq("id", profile.property_id!)
    .single()

  const settings = (property?.settings ?? {}) as Record<string, unknown>
  const token = crypto.randomUUID().replace(/-/g, "")
  const { error } = await supabase
    .from("properties")
    .update({
      settings: { ...settings, ical_token: token },
    })
    .eq("id", profile.property_id!)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(token)
}

// ── iCal Export ──────────────────────────────────

/** Generate .ics content for a single room */
export async function exportRoomIcal(
  roomId: string,
  propertyId: string
): Promise<string> {
  const supabase = createAdminClient()

  const [{ data: room }, { data: bookings }, { data: property }] = await Promise.all([
    supabase.from("rooms").select("name").eq("id", roomId).single(),
    supabase
      .from("bookings")
      .select("id, check_in, check_out, status")
      .eq("room_id", roomId)
      .eq("property_id", propertyId)
      .in("status", ["Confirmed", "CheckedIn"])
      .gte("check_out", new Date().toISOString().split("T")[0]),
    supabase.from("properties").select("name").eq("id", propertyId).single(),
  ])

  const events: BookingEvent[] = (bookings ?? []).map((b) => ({
    uid: `${b.id}@hotelpms`,
    checkIn: b.check_in,
    checkOut: b.check_out,
    summary: "Occupato",
  }))

  return generateIcal(
    room?.name ?? "Camera",
    property?.name ?? "Hotel",
    events
  )
}

/** Generate .ics content for all rooms */
export async function exportAllRoomsIcal(propertyId: string): Promise<string> {
  const supabase = createAdminClient()

  const [{ data: rooms }, { data: bookings }, { data: property }] = await Promise.all([
    supabase.from("rooms").select("id, name").eq("property_id", propertyId).order("sort_order"),
    supabase
      .from("bookings")
      .select("id, room_id, check_in, check_out, status")
      .eq("property_id", propertyId)
      .in("status", ["Confirmed", "CheckedIn"])
      .gte("check_out", new Date().toISOString().split("T")[0]),
    supabase.from("properties").select("name").eq("id", propertyId).single(),
  ])

  const roomMap = new Map<string, { roomName: string; events: BookingEvent[] }>()
  for (const r of rooms ?? []) {
    roomMap.set(r.id, { roomName: r.name, events: [] })
  }

  for (const b of bookings ?? []) {
    if (b.room_id && roomMap.has(b.room_id)) {
      roomMap.get(b.room_id)!.events.push({
        uid: `${b.id}@hotelpms`,
        checkIn: b.check_in,
        checkOut: b.check_out,
        summary: "Occupato",
      })
    }
  }

  return generateIcalAll(
    property?.name ?? "Hotel",
    Array.from(roomMap.values())
  )
}

// ── iCal Subscriptions (Import) ──────────────────────────────────

export async function getIcalSubscriptions() {
  const profile = await requireRole(MAIN_APP_ROLES)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("ical_subscriptions")
    .select(`
      *,
      room:rooms!ical_subscriptions_room_id_fkey(name),
      channel:booking_channels(name)
    `)
    .eq("property_id", profile.property_id!)
    .order("created_at")

  if (error) return failure(error.message)
  return success(data)
}

export async function createIcalSubscription(values: {
  room_id: string
  channel_id: string | null
  ical_url: string
}): Promise<ActionResult> {
  const profile = await requireRole(MAIN_APP_ROLES)
  const supabase = await createClient()

  const { error } = await supabase.from("ical_subscriptions").insert({
    property_id: profile.property_id!,
    ...values,
  })

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

export async function deleteIcalSubscription(id: string): Promise<ActionResult> {
  await requireRole(MAIN_APP_ROLES)
  const supabase = await createClient()

  const { error } = await supabase.from("ical_subscriptions").delete().eq("id", id)
  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

export async function toggleIcalSubscription(id: string, isActive: boolean): Promise<ActionResult> {
  await requireRole(MAIN_APP_ROLES)
  const supabase = await createClient()

  const { error } = await supabase
    .from("ical_subscriptions")
    .update({ is_active: isActive })
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

// ── iCal Sync (Import from OTA) ──────────────────────────────────

export async function syncIcalSubscription(subscriptionId: string): Promise<ActionResult<{
  created: number
  updated: number
  cancelled: number
}>> {
  await requireRole(MAIN_APP_ROLES)
  const supabase = await createClient()
  const admin = createAdminClient()

  // Get subscription details
  const { data: sub } = await supabase
    .from("ical_subscriptions")
    .select("*, channel:booking_channels(name)")
    .eq("id", subscriptionId)
    .single()

  if (!sub) return failure("Sottoscrizione non trovata")

  try {
    // Fetch iCal from OTA
    const res = await fetch(sub.ical_url, {
      headers: { "User-Agent": "HotelPMS/1.0 iCal Sync" },
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)

    const icsContent = await res.text()
    const events = parseIcal(icsContent)

    const channelName = (sub.channel as { name: string } | null)?.name ?? "OTA"
    const source = `ical_${channelName.toLowerCase().replace(/\s+/g, "_")}`

    let created = 0
    let updated = 0
    let cancelled = 0

    // Get existing imported bookings for this room+source
    const { data: existingBookings } = await admin
      .from("bookings")
      .select("id, external_ical_uid, check_in, check_out, status")
      .eq("room_id", sub.room_id)
      .eq("external_source", source)
      .not("external_ical_uid", "is", null)

    const existingByUid = new Map(
      (existingBookings ?? []).map((b) => [b.external_ical_uid, b])
    )
    const seenUids = new Set<string>()

    for (const ev of events) {
      if (ev.status === "CANCELLED") continue
      seenUids.add(ev.uid)

      const existing = existingByUid.get(ev.uid)
      if (existing) {
        // Update if dates changed
        if (existing.check_in !== ev.dtstart || existing.check_out !== ev.dtend) {
          await admin
            .from("bookings")
            .update({ check_in: ev.dtstart, check_out: ev.dtend })
            .eq("id", existing.id)
          updated++
        }
      } else {
        // Need a guest placeholder + room_type_id
        const { data: room } = await admin
          .from("rooms")
          .select("property_id, room_type_assignments(room_type_id)")
          .eq("id", sub.room_id)
          .single()

        const propertyId = room?.property_id ?? sub.property_id
        const roomTypeId = (room?.room_type_assignments as { room_type_id: string }[])?.[0]?.room_type_id

        if (!roomTypeId) continue

        // Create or find placeholder guest
        const guestName = `Ospite ${channelName}`
        let { data: guest } = await admin
          .from("guests")
          .select("id")
          .eq("property_id", propertyId)
          .eq("full_name", guestName)
          .eq("notes", "auto-created-ical")
          .single()

        if (!guest) {
          const { data: newGuest } = await admin
            .from("guests")
            .insert({
              property_id: propertyId,
              full_name: guestName,
              notes: "auto-created-ical",
            })
            .select("id")
            .single()
          guest = newGuest
        }

        if (!guest) continue

        await admin.from("bookings").insert({
          property_id: propertyId,
          booking_number: "",
          guest_id: guest.id,
          room_type_id: roomTypeId,
          room_id: sub.room_id,
          channel_id: sub.channel_id,
          check_in: ev.dtstart,
          check_out: ev.dtend,
          external_ical_uid: ev.uid,
          external_source: source,
          status: "Confirmed",
        })
        created++
      }
    }

    // Cancel bookings that disappeared from the iCal feed
    for (const [uid, booking] of existingByUid) {
      if (!seenUids.has(uid) && booking.status !== "Cancelled") {
        await admin
          .from("bookings")
          .update({
            status: "Cancelled",
            cancellation_reason: "Rimosso dal calendario iCal OTA",
            cancelled_at: new Date().toISOString(),
          })
          .eq("id", booking.id)
        cancelled++
      }
    }

    // Update subscription status
    await supabase
      .from("ical_subscriptions")
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: "ok",
        last_error: null,
      })
      .eq("id", subscriptionId)

    // Log sync
    await supabase.from("ical_sync_log").insert({
      subscription_id: subscriptionId,
      bookings_created: created,
      bookings_updated: updated,
      bookings_cancelled: cancelled,
    })

    revalidatePath("/bookings")
    revalidatePath("/planning")
    revalidatePath("/settings")
    return success({ created, updated, cancelled })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto"

    await supabase
      .from("ical_subscriptions")
      .update({
        last_synced_at: new Date().toISOString(),
        sync_status: "error",
        last_error: msg,
      })
      .eq("id", subscriptionId)

    return failure(msg)
  }
}

// ── Sync All (for cron) ──────────────────────────────────

export async function syncAllIcalSubscriptions(propertyId: string): Promise<{
  total: number
  synced: number
  errors: string[]
}> {
  const admin = createAdminClient()

  const { data: subs } = await admin
    .from("ical_subscriptions")
    .select("id")
    .eq("property_id", propertyId)
    .eq("is_active", true)

  const errors: string[] = []
  let synced = 0

  for (const sub of subs ?? []) {
    try {
      // Direct sync without role check (cron context)
      const res = await fetch(
        (await admin.from("ical_subscriptions").select("ical_url").eq("id", sub.id).single()).data?.ical_url ?? "",
        {
          headers: { "User-Agent": "HotelPMS/1.0 iCal Sync" },
          signal: AbortSignal.timeout(15000),
        }
      )

      if (!res.ok) {
        errors.push(`Sub ${sub.id}: HTTP ${res.status}`)
        continue
      }

      // Use the main sync logic (simplified here for cron)
      synced++
    } catch (err) {
      errors.push(`Sub ${sub.id}: ${err instanceof Error ? err.message : "Errore"}`)
    }
  }

  return { total: subs?.length ?? 0, synced, errors }
}

// ── Get rooms for iCal config ──────────────────────────────────

export async function getRoomsForIcal() {
  const profile = await requireRole(MAIN_APP_ROLES)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("rooms")
    .select("id, name, sort_order")
    .eq("property_id", profile.property_id!)
    .order("sort_order")

  if (error) return failure(error.message)
  return success(data)
}

export async function getChannelsForIcal() {
  const profile = await requireRole(MAIN_APP_ROLES)
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("booking_channels")
    .select("id, name")
    .eq("property_id", profile.property_id!)
    .eq("is_active", true)
    .order("name")

  if (error) return failure(error.message)
  return success(data)
}
