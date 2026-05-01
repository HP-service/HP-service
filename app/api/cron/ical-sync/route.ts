import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseIcal } from "@ical/parser"

/**
 * GET /api/cron/ical-sync?secret={CRON_SECRET}
 * Cron endpoint: sync all active iCal subscriptions.
 * Protected by CRON_SECRET env variable.
 * Schedule: every 15 minutes via Vercel Cron or external cron service.
 */
export async function GET(request: NextRequest) {
  // Vercel Cron usa l'header `Authorization: Bearer <CRON_SECRET>` automaticamente.
  // Supportiamo anche `?secret=` per chiamate manuali.
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET non configurato" },
      { status: 500 },
    )
  }
  const fromHeader = request.headers.get("authorization") === `Bearer ${expected}`
  const fromQuery = request.nextUrl.searchParams.get("secret") === expected
  if (!fromHeader && !fromQuery) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  }

  const admin = createAdminClient()

  const { data: subs } = await admin
    .from("ical_subscriptions")
    .select("id, ical_url, room_id, property_id, channel_id")
    .eq("is_active", true)

  const results = []

  for (const sub of subs ?? []) {
    try {
      const res = await fetch(sub.ical_url, {
        headers: { "User-Agent": "HotelPMS/1.0 iCal Sync" },
        signal: AbortSignal.timeout(15000),
      })

      if (!res.ok) {
        await admin
          .from("ical_subscriptions")
          .update({ sync_status: "error", last_error: `HTTP ${res.status}`, last_synced_at: new Date().toISOString() })
          .eq("id", sub.id)
        results.push({ id: sub.id, status: "error", error: `HTTP ${res.status}` })
        continue
      }

      const icsContent = await res.text()
      const events = parseIcal(icsContent)

      // Get channel name for source
      let channelName = "ota"
      if (sub.channel_id) {
        const { data: ch } = await admin
          .from("booking_channels")
          .select("name")
          .eq("id", sub.channel_id)
          .single()
        if (ch) channelName = ch.name.toLowerCase().replace(/\s+/g, "_")
      }
      const source = `ical_${channelName}`

      // Get existing imported bookings
      const { data: existing } = await admin
        .from("bookings")
        .select("id, external_ical_uid, check_in, check_out, status")
        .eq("room_id", sub.room_id)
        .eq("external_source", source)
        .not("external_ical_uid", "is", null)

      const existingByUid = new Map(
        (existing ?? []).map((b) => [b.external_ical_uid, b])
      )
      const seenUids = new Set<string>()
      let created = 0, updated = 0, cancelled = 0

      for (const ev of events) {
        if (ev.status === "CANCELLED") continue
        seenUids.add(ev.uid)

        const ex = existingByUid.get(ev.uid)
        if (ex) {
          if (ex.check_in !== ev.dtstart || ex.check_out !== ev.dtend) {
            await admin
              .from("bookings")
              .update({ check_in: ev.dtstart, check_out: ev.dtend })
              .eq("id", ex.id)
            updated++
          }
        } else {
          // Get room info for room_type
          const { data: room } = await admin
            .from("rooms")
            .select("property_id, room_type_assignments(room_type_id)")
            .eq("id", sub.room_id)
            .single()

          const roomTypeId = (room?.room_type_assignments as { room_type_id: string }[])?.[0]?.room_type_id
          if (!roomTypeId) continue

          // Placeholder guest
          const guestName = `Ospite ${channelName}`
          let { data: guest } = await admin
            .from("guests")
            .select("id")
            .eq("property_id", sub.property_id)
            .eq("full_name", guestName)
            .eq("notes", "auto-created-ical")
            .single()

          if (!guest) {
            const { data: ng } = await admin
              .from("guests")
              .insert({ property_id: sub.property_id, full_name: guestName, notes: "auto-created-ical" })
              .select("id")
              .single()
            guest = ng
          }
          if (!guest) continue

          await admin.from("bookings").insert({
            property_id: sub.property_id,
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

      // Cancel removed events
      for (const [uid, booking] of existingByUid) {
        if (!seenUids.has(uid) && booking.status !== "Cancelled") {
          await admin
            .from("bookings")
            .update({ status: "Cancelled", cancellation_reason: "Rimosso dal calendario iCal", cancelled_at: new Date().toISOString() })
            .eq("id", booking.id)
          cancelled++
        }
      }

      // Update subscription
      await admin
        .from("ical_subscriptions")
        .update({ sync_status: "ok", last_error: null, last_synced_at: new Date().toISOString() })
        .eq("id", sub.id)

      // Log
      await admin.from("ical_sync_log").insert({
        subscription_id: sub.id,
        bookings_created: created,
        bookings_updated: updated,
        bookings_cancelled: cancelled,
      })

      results.push({ id: sub.id, status: "ok", created, updated, cancelled })
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Errore"
      await admin
        .from("ical_subscriptions")
        .update({ sync_status: "error", last_error: msg, last_synced_at: new Date().toISOString() })
        .eq("id", sub.id)
      results.push({ id: sub.id, status: "error", error: msg })
    }
  }

  return NextResponse.json({
    synced: results.filter((r) => r.status === "ok").length,
    errors: results.filter((r) => r.status === "error").length,
    total: results.length,
    details: results,
  })
}
