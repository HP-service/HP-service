import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Check availability for a room type in a date range.
 * Uses the DB function get_availability() via RPC.
 */
export async function checkAvailability(
  supabase: SupabaseClient,
  propertyId: string,
  roomTypeId: string,
  checkIn: string,
  checkOut: string
): Promise<{ available: number; error: string | null }> {
  const { data, error } = await supabase.rpc("get_availability", {
    p_property_id: propertyId,
    p_room_type_id: roomTypeId,
    p_check_in: checkIn,
    p_check_out: checkOut,
  })

  if (error) {
    return { available: 0, error: error.message }
  }

  return { available: data ?? 0, error: null }
}

/**
 * Find the best available room for a room type.
 * Uses the DB function find_best_room() via RPC.
 */
export async function findBestRoom(
  supabase: SupabaseClient,
  propertyId: string,
  roomTypeId: string,
  checkIn: string,
  checkOut: string
): Promise<{ roomId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("find_best_room", {
    p_property_id: propertyId,
    p_room_type_id: roomTypeId,
    p_check_in: checkIn,
    p_check_out: checkOut,
  })

  if (error) {
    return { roomId: null, error: error.message }
  }

  return { roomId: data, error: null }
}

/**
 * Get availability for all room types on a specific date range.
 * Useful for the planning chart overview.
 */
export async function getAvailabilityOverview(
  supabase: SupabaseClient,
  propertyId: string,
  checkIn: string,
  checkOut: string
): Promise<{
  data: Array<{ room_type_id: string; room_type_name: string; available: number }>
  error: string | null
}> {
  // Get all active room types
  const { data: roomTypes, error: rtError } = await supabase
    .from("room_types")
    .select("id, name")
    .eq("property_id", propertyId)
    .eq("is_active", true)
    .order("sort_order")

  if (rtError) {
    return { data: [], error: rtError.message }
  }

  // Check availability for each
  const results = await Promise.all(
    (roomTypes ?? []).map(async (rt) => {
      const { available } = await checkAvailability(
        supabase,
        propertyId,
        rt.id,
        checkIn,
        checkOut
      )
      return {
        room_type_id: rt.id,
        room_type_name: rt.name,
        available,
      }
    })
  )

  return { data: results, error: null }
}
