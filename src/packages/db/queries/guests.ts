"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"

export async function getGuests(search?: string) {
  const supabase = await createClient()
  let query = supabase
    .from("guests")
    .select("*")
    .order("full_name")
    .limit(100)

  if (search) {
    query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
  }

  const { data, error } = await query
  if (error) return failure(error.message)
  return success(data)
}

export async function getGuest(id: string) {
  try {
    if (!id || typeof id !== "string") return failure("ID ospite non valido")
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .eq("id", id)
      .maybeSingle()

    if (error) return failure(error.message)
    if (!data) return failure("Ospite non trovato")
    return success(data)
  } catch (err) {
    console.error("[getGuest]", err)
    return failure(err instanceof Error ? err.message : "Errore recupero ospite")
  }
}

export async function getGuestBookings(guestId: string) {
  try {
    if (!guestId || typeof guestId !== "string") return success([])
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("bookings")
      .select(`
        *,
        room_type:room_type_id (name),
        room:room_id (name)
      `)
      .eq("guest_id", guestId)
      .order("check_in", { ascending: false })

    if (error) {
      console.warn("[getGuestBookings]", error.message)
      return success([])
    }
    return success(data ?? [])
  } catch (err) {
    console.error("[getGuestBookings]", err)
    return success([])
  }
}

export async function createGuest(
  propertyId: string,
  values: {
    full_name: string
    email?: string
    phone?: string
    nationality?: string
    document_type?: string
    document_number?: string
    document_expiry?: string
    date_of_birth?: string
    tax_code?: string
    address?: string
    city?: string
    country?: string
    notes?: string
    tags?: string[]
  }
) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("guests")
    .insert({ property_id: propertyId, ...values })
    .select()
    .single()

  if (error) return failure(error.message)
  revalidatePath("/guests")
  return success(data)
}

export async function updateGuest(
  id: string,
  values: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("guests")
    .update(values)
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/guests")
  return success(undefined)
}
