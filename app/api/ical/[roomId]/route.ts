import { NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { exportRoomIcal } from "@db/queries/ical"

/**
 * GET /api/ical/{roomId}?token={secret}
 * Export iCal feed for a single room.
 * Protected by a per-property secret token.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params
  const token = request.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.json({ error: "Token mancante" }, { status: 401 })
  }

  // Find property by room and validate token
  const supabase = createAdminClient()
  const { data: room } = await supabase
    .from("rooms")
    .select("property_id")
    .eq("id", roomId)
    .single()

  if (!room) {
    return NextResponse.json({ error: "Camera non trovata" }, { status: 404 })
  }

  const { data: property } = await supabase
    .from("properties")
    .select("settings")
    .eq("id", room.property_id)
    .single()

  const settings = (property?.settings ?? {}) as Record<string, unknown>
  if (settings.ical_token !== token) {
    return NextResponse.json({ error: "Token non valido" }, { status: 403 })
  }

  const ics = await exportRoomIcal(roomId, room.property_id)

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="room-${roomId}.ics"`,
      "Cache-Control": "public, max-age=900", // 15 min cache
    },
  })
}
