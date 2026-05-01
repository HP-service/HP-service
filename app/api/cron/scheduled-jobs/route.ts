import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { parseIcal } from "@ical/parser"

/**
 * GET /api/cron/scheduled-jobs
 *
 * Endpoint cron unificato (consolida tutti i job ricorrenti in un solo cron Vercel).
 * Schedule consigliato: orario (`0 * * * *`) — su Vercel Hobby fa 24 invocazioni/giorno.
 *
 * Dispatch interno:
 * - iCal sync: ogni esecuzione
 * - Sweep stale check-ins: solo quando ora == 12 (UTC)
 *
 * Auth: Authorization: Bearer {CRON_SECRET}  oppure  ?secret={CRON_SECRET}
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET non configurato" }, { status: 500 })
  }
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const query = request.nextUrl.searchParams.get("secret")
  const token = bearer || query
  if (token !== expected) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  }

  const now = new Date()
  const hourUtc = now.getUTCHours()
  const admin = createAdminClient()

  const summary: {
    timestamp: string
    icalSync?: { processed: number; errors: number }
    sweepStaleCheckins?: { swept: number; error?: string }
  } = { timestamp: now.toISOString() }

  // ─── 1. iCal sync (ogni esecuzione) ────────────────────────────────────────
  try {
    const { data: subs } = await admin
      .from("ical_subscriptions")
      .select("id, ical_url, room_id, property_id, channel_id")
      .eq("is_active", true)

    let processed = 0
    let errors = 0

    for (const sub of subs ?? []) {
      try {
        const res = await fetch(sub.ical_url, {
          headers: { "User-Agent": "HotelPMS/1.0 iCal Sync" },
          signal: AbortSignal.timeout(15000),
        })

        if (!res.ok) {
          await admin
            .from("ical_subscriptions")
            .update({
              sync_status: "error",
              last_error: `HTTP ${res.status}`,
              last_synced_at: now.toISOString(),
            })
            .eq("id", sub.id)
          errors++
          continue
        }

        const text = await res.text()
        const events = parseIcal(text)

        let created = 0
        let updated = 0
        let cancelled = 0

        for (const ev of events) {
          const { data: existing } = await admin
            .from("bookings")
            .select("id, status")
            .eq("external_ref", ev.uid)
            .maybeSingle()

          if (ev.status === "CANCELLED") {
            if (existing) {
              await admin
                .from("bookings")
                .update({ status: "Cancelled" })
                .eq("id", existing.id)
              cancelled++
            }
            continue
          }

          if (existing) {
            await admin
              .from("bookings")
              .update({
                check_in: ev.dtstart,
                check_out: ev.dtend,
              })
              .eq("id", existing.id)
            updated++
          } else {
            await admin.from("bookings").insert({
              property_id: sub.property_id,
              room_id: sub.room_id,
              channel_id: sub.channel_id,
              external_ref: ev.uid,
              check_in: ev.dtstart,
              check_out: ev.dtend,
              status: "Confirmed",
              adults: 1,
              children: 0,
              booking_number: "",
            })
            created++
          }
        }

        await admin
          .from("ical_subscriptions")
          .update({
            sync_status: "ok",
            last_error: null,
            last_synced_at: now.toISOString(),
          })
          .eq("id", sub.id)

        processed++
        // log eventi (non bloccante)
        void created
        void updated
        void cancelled
      } catch (err) {
        errors++
        await admin
          .from("ical_subscriptions")
          .update({
            sync_status: "error",
            last_error: err instanceof Error ? err.message : "Errore sconosciuto",
            last_synced_at: now.toISOString(),
          })
          .eq("id", sub.id)
      }
    }

    summary.icalSync = { processed, errors }
  } catch (err) {
    summary.icalSync = {
      processed: 0,
      errors: -1,
    }
    console.error("[scheduled-jobs] iCal sync failed:", err)
  }

  // ─── 2. Sweep stale check-ins (solo a mezzogiorno UTC) ─────────────────────
  if (hourUtc === 12) {
    try {
      const { data, error } = await admin.rpc("sweep_stale_checkins")
      if (error) {
        summary.sweepStaleCheckins = { swept: 0, error: error.message }
      } else {
        summary.sweepStaleCheckins = {
          swept: typeof data === "number" ? data : 0,
        }
      }
    } catch (err) {
      summary.sweepStaleCheckins = {
        swept: 0,
        error: err instanceof Error ? err.message : "Errore sconosciuto",
      }
    }
  }

  return NextResponse.json({ ok: true, ...summary })
}
