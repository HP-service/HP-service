import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * GET /api/cron/sweep-stale-checkins
 *
 * Chiude automaticamente le prenotazioni rimaste CheckedIn con
 * check_out < CURRENT_DATE. Logica hotel/B&B standard:
 *   - prenotazione → CheckedOut (checked_out_at = check_out + 11:00)
 *   - camera → Available (se era Occupied) + cleaning_status = 'Dirty'
 *
 * Auth: accetta sia
 *   - Authorization: Bearer {CRON_SECRET}  (Vercel Cron, raccomandato)
 *   - ?secret={CRON_SECRET}                (cron esterni legacy)
 *
 * Schedule consigliato: giornaliero alle 12:00 UTC (vercel.json).
 * Usa la funzione Postgres `sweep_stale_checkins()` (vedi
 * supabase/fix_auto_checkout_and_loyalty.sql).
 */
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET non configurato" }, { status: 500 })
  }

  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "")
  const query  = request.nextUrl.searchParams.get("secret")
  const token  = bearer || query

  if (token !== expected) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin.rpc("sweep_stale_checkins")

  if (error) {
    return NextResponse.json(
      { error: error.message, swept: 0 },
      { status: 500 }
    )
  }

  const swept = typeof data === "number" ? data : 0

  return NextResponse.json({
    ok: true,
    swept,
    timestamp: new Date().toISOString(),
  })
}
