"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"

// ============================================
// Room Types
// ============================================

export async function getRoomTypes() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("room_types")
    .select("*")
    .order("sort_order")

  if (error) return failure(error.message)
  return success(data)
}

export async function createRoomType(
  propertyId: string,
  values: {
    name: string
    description?: string
    short_code?: string
    default_capacity?: number
    max_capacity?: number
    base_price?: number
    amenities?: string[]
    sort_order?: number
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("room_types")
    .insert({ property_id: propertyId, ...values })

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

export async function updateRoomType(
  id: string,
  values: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("room_types")
    .update(values)
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

export async function deleteRoomType(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("room_types")
    .delete()
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

// ============================================
// Rooms
// ============================================

export async function getRooms() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("rooms")
    .select(`
      *,
      room_type_assignments (
        id,
        room_type_id,
        priority,
        is_active,
        room_types:room_type_id (id, name, short_code)
      )
    `)
    .order("sort_order")

  if (error) return failure(error.message)
  return success(data)
}

export async function getRoom(id: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("rooms")
    .select(`
      *,
      room_type_assignments (
        id,
        room_type_id,
        priority,
        is_active,
        room_types:room_type_id (id, name, short_code, base_price)
      )
    `)
    .eq("id", id)
    .single()

  if (error) return failure(error.message)
  return success(data)
}

export async function createRoom(
  propertyId: string,
  values: {
    name: string
    floor?: number
    notes?: string
    features?: string[]
    sort_order?: number
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("rooms")
    .insert({ property_id: propertyId, ...values })

  if (error) return failure(error.message)
  revalidatePath("/settings")
  revalidatePath("/rooms")
  return success(undefined)
}

export async function updateRoom(
  id: string,
  values: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("rooms")
    .update(values)
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  revalidatePath("/rooms")
  return success(undefined)
}

// ============================================
// Room Type Assignments
// ============================================

export async function assignRoomType(
  roomId: string,
  roomTypeId: string,
  priority: number = 1
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("room_type_assignments")
    .upsert(
      { room_id: roomId, room_type_id: roomTypeId, priority, is_active: true },
      { onConflict: "room_id,room_type_id" }
    )

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

export async function removeRoomTypeAssignment(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("room_type_assignments")
    .delete()
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

// ============================================
// Booking Channels
// ============================================

export async function getChannels() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("booking_channels")
    .select("*")
    .order("name")

  if (error) return failure(error.message)
  return success(data)
}

export async function createChannel(
  propertyId: string,
  values: { name: string; commission_rate?: number }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("booking_channels")
    .insert({ property_id: propertyId, ...values })

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

export async function updateChannel(
  id: string,
  values: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("booking_channels")
    .update(values)
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

// ============================================
// Staff (uses admin client for auth operations)
// ============================================

export async function getStaff() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("full_name")

  if (error) return failure(error.message)
  return success(data)
}

// ============================================
// Expense Categories
// ============================================

export async function getExpenseCategories() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("expense_categories")
    .select("*")
    .order("sort_order")

  if (error) return failure(error.message)
  return success(data)
}

export async function createExpenseCategory(
  propertyId: string,
  values: { name: string; parent_id?: string; color?: string; sort_order?: number }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("expense_categories")
    .insert({ property_id: propertyId, ...values })

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

// ============================================
// Property Setup (creates default data)
// ============================================

export async function setupPropertyDefaults(propertyId: string): Promise<ActionResult> {
  const supabase = await createClient()

  // Default booking channels
  const channels = [
    { property_id: propertyId, name: "Diretto", commission_rate: 0 },
    { property_id: propertyId, name: "Booking.com", commission_rate: 15 },
    { property_id: propertyId, name: "Airbnb", commission_rate: 12 },
    { property_id: propertyId, name: "Expedia", commission_rate: 18 },
    { property_id: propertyId, name: "Telefono", commission_rate: 0 },
    { property_id: propertyId, name: "Email", commission_rate: 0 },
  ]

  const { error: chError } = await supabase
    .from("booking_channels")
    .insert(channels)

  if (chError) return failure(chError.message)

  // Default expense categories
  const categories = [
    { property_id: propertyId, name: "Pulizia", color: "#3B82F6", sort_order: 1 },
    { property_id: propertyId, name: "Manutenzione", color: "#F59E0B", sort_order: 2 },
    { property_id: propertyId, name: "Utenze", color: "#10B981", sort_order: 3 },
    { property_id: propertyId, name: "Forniture", color: "#8B5CF6", sort_order: 4 },
    { property_id: propertyId, name: "Personale", color: "#EF4444", sort_order: 5 },
    { property_id: propertyId, name: "Marketing", color: "#EC4899", sort_order: 6 },
    { property_id: propertyId, name: "Assicurazione", color: "#6366F1", sort_order: 7 },
    { property_id: propertyId, name: "Tasse e Imposte", color: "#64748B", sort_order: 8 },
    { property_id: propertyId, name: "Altro", color: "#94A3B8", sort_order: 99 },
  ]

  const { error: catError } = await supabase
    .from("expense_categories")
    .insert(categories)

  if (catError) return failure(catError.message)

  return success(undefined)
}

// ============================================
// Property
// ============================================

export async function getProperty() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("properties")
    .select("*")
    .single()

  if (error) return failure(error.message)
  return success(data)
}

export async function updateProperty(
  id: string,
  values: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("properties")
    .update(values)
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

export async function deleteRoom(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("rooms")
    .delete()
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  revalidatePath("/rooms")
  return success(undefined)
}

export async function deleteChannel(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("booking_channels")
    .delete()
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}
