"use server"

import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"

// ── Types ──────────────────────────────────

export type GuestSession = {
  booking_id: string
  property_id: string
  room_name: string
  guest_name: string
  check_out: string
}

const COOKIE_NAME = "hotel_guest_session"
const COOKIE_MAX_AGE = 60 * 60 * 24 // 24h

// ── Auth ──────────────────────────────────

export async function loginGuest(
  roomName: string,
  accessCode: string
): Promise<ActionResult<GuestSession>> {
  // Use admin client: guest is not authenticated, RLS would block bookings read
  const supabase = createAdminClient()

  // Find active booking with matching room + code
  const { data: bookings, error } = await supabase
    .from("bookings")
    .select(`
      id,
      property_id,
      check_out,
      guest_access_code,
      guest:guests!bookings_guest_id_fkey(full_name),
      room:rooms!bookings_room_id_fkey(name)
    `)
    .eq("status", "CheckedIn")
    .not("guest_access_code", "is", null)

  if (error) return failure(error.message)

  // Match room name + code (case-insensitive)
  // Supabase joins can return object or array depending on FK; cast via unknown
  const match = bookings?.find((b) => {
    const r = b.room as unknown as { name: string } | null
    return r?.name?.toLowerCase() === roomName.toLowerCase() &&
      b.guest_access_code?.toUpperCase() === accessCode.toUpperCase()
  })

  if (!match) return failure("Camera o codice non valido")

  const guest = match.guest as unknown as { full_name: string } | null
  const room = match.room as unknown as { name: string } | null

  const session: GuestSession = {
    booking_id: match.id,
    property_id: match.property_id,
    room_name: room?.name ?? roomName,
    guest_name: guest?.full_name ?? "Ospite",
    check_out: match.check_out,
  }

  // Set cookie
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // path "/" è necessario perché la chat concierge chiama /api/guest-chat
    // (fuori dal path /guest) → con path="/guest" la cookie non veniva inviata
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax",
  })

  return success(session)
}

export async function getGuestSession(): Promise<GuestSession | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(COOKIE_NAME)?.value
  if (!raw) return null

  try {
    const session: GuestSession = JSON.parse(raw)

    // Re-validate: booking must still be CheckedIn
    const supabase = createAdminClient()
    const { data } = await supabase
      .from("bookings")
      .select("status")
      .eq("id", session.booking_id)
      .single()

    if (!data || data.status !== "CheckedIn") {
      cookieStore.delete({ name: COOKIE_NAME, path: "/" })
      return null
    }

    return session
  } catch {
    cookieStore.delete({ name: COOKIE_NAME, path: "/" })
    return null
  }
}

export async function logoutGuest() {
  const cookieStore = await cookies()
  cookieStore.delete({ name: COOKIE_NAME, path: "/" })
}

// ── Guest Data Fetching ──────────────────────────────────

export async function getPortalData(propertyId: string) {
  // Admin client: guest uses cookie-based session, not Supabase auth
  const supabase = createAdminClient()

  const [servicesRes, attractionsRes, propertyRes] = await Promise.all([
    supabase
      .from("portal_services")
      .select("*")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("portal_attractions")
      .select("*")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("properties")
      .select("name, settings, check_out_time")
      .eq("id", propertyId)
      .single(),
  ])

  return {
    services: servicesRes.data ?? [],
    attractions: attractionsRes.data ?? [],
    property: propertyRes.data,
  }
}

// ── Regenerate Access Code (admin) ──────────────────────────────────

export async function regenerateGuestCode(
  bookingId: string
): Promise<ActionResult<string>> {
  const supabase = await createClient()
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      guest_access_code: code,
      guest_code_generated_at: new Date().toISOString(),
    })
    .eq("id", bookingId)

  if (error) return failure(error.message)
  revalidatePath(`/bookings/${bookingId}`)
  return success(code)
}
