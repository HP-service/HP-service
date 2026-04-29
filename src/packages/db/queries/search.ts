"use server"

import { createClient } from "@/lib/supabase/server"

export type SearchHit = {
  kind: "booking" | "guest" | "room"
  id: string
  title: string
  subtitle?: string
  href: string
}

type SearchResult =
  | { ok: true; hits: SearchHit[] }
  | { ok: false; error: string }

export async function searchAll(query: string): Promise<SearchResult> {
  if (!query || query.trim().length < 2) {
    return { ok: true, hits: [] }
  }
  const q = query.trim()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Non autenticato" }

  const { data: profile } = await supabase
    .from("profiles")
    .select("property_id")
    .eq("id", user.id)
    .single()

  if (!profile?.property_id) return { ok: true, hits: [] }
  const pid = profile.property_id

  // Esegui in parallelo
  const [bookingsRes, guestsRes, roomsRes] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        "id, booking_number, check_in, check_out, status, guests:guest_id ( full_name )",
      )
      .eq("property_id", pid)
      .or(`booking_number.ilike.%${q}%`)
      .limit(5),
    supabase
      .from("guests")
      .select("id, full_name, email, phone")
      .eq("property_id", pid)
      .or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`)
      .limit(5),
    supabase
      .from("rooms")
      .select("id, name, floor, status")
      .eq("property_id", pid)
      .ilike("name", `%${q}%`)
      .limit(5),
  ])

  const hits: SearchHit[] = []

  for (const b of bookingsRes.data ?? []) {
    const guestRaw = b.guests as { full_name: string } | { full_name: string }[] | null
    const guest = Array.isArray(guestRaw) ? guestRaw[0] : guestRaw
    hits.push({
      kind: "booking",
      id: b.id,
      title: b.booking_number,
      subtitle: `${guest?.full_name ?? "—"} · ${b.check_in} → ${b.check_out}`,
      href: `/bookings/${b.id}`,
    })
  }
  for (const g of guestsRes.data ?? []) {
    hits.push({
      kind: "guest",
      id: g.id,
      title: g.full_name,
      subtitle: g.email || g.phone || undefined,
      href: `/guests/${g.id}`,
    })
  }
  for (const r of roomsRes.data ?? []) {
    hits.push({
      kind: "room",
      id: r.id,
      title: `Camera ${r.name}`,
      subtitle: r.floor != null ? `Piano ${r.floor}` : undefined,
      href: `/rooms/${r.id}`,
    })
  }

  // Cerca anche per nome ospite dentro bookings
  if (hits.filter((h) => h.kind === "booking").length === 0 && (guestsRes.data?.length ?? 0) > 0) {
    const guestIds = (guestsRes.data ?? []).map((g) => g.id)
    if (guestIds.length > 0) {
      const { data: extraB } = await supabase
        .from("bookings")
        .select(
          "id, booking_number, check_in, check_out, guests:guest_id ( full_name )",
        )
        .eq("property_id", pid)
        .in("guest_id", guestIds)
        .order("check_in", { ascending: false })
        .limit(5)
      for (const b of extraB ?? []) {
        const guestRaw = b.guests as { full_name: string } | { full_name: string }[] | null
        const guest = Array.isArray(guestRaw) ? guestRaw[0] : guestRaw
        hits.push({
          kind: "booking",
          id: b.id,
          title: b.booking_number,
          subtitle: `${guest?.full_name ?? "—"} · ${b.check_in} → ${b.check_out}`,
          href: `/bookings/${b.id}`,
        })
      }
    }
  }

  return { ok: true, hits: hits.slice(0, 12) }
}
