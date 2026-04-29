import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { exportAllRoomsIcal } from "@db/queries/ical"

/**
 * GET /api/ical/all?token={secret}&propertyId={id}
 * Export combined iCal feed for all rooms of a property.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")
  const propertyId = request.nextUrl.searchParams.get("propertyId")

  if (!token || !propertyId) {
    return NextResponse.json({ error: "Token e propertyId richiesti" }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: property } = await supabase
    .from("properties")
    .select("settings")
    .eq("id", propertyId)
    .single()

  if (!property) {
    return NextResponse.json({ error: "Struttura non trovata" }, { status: 404 })
  }

  const settings = (property.settings ?? {}) as Record<string, unknown>
  if (settings.ical_token !== token) {
    return NextResponse.json({ error: "Token non valido" }, { status: 403 })
  }

  const ics = await exportAllRoomsIcal(propertyId)

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="all-rooms.ics"`,
      "Cache-Control": "public, max-age=900",
    },
  })
}
