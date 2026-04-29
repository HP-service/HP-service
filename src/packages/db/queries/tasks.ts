"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"

export async function getTasks(filters?: {
  status?: string
  assigned_to?: string
  room_id?: string
  types?: string[]
}) {
  const supabase = await createClient()
  let query = supabase
    .from("tasks")
    .select(`
      *,
      room:room_id (id, name),
      assigned_to_profile:assigned_to (id, full_name, role),
      booking:booking_id (id, booking_number, guest:guest_id (full_name))
    `)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false })

  if (filters?.status) query = query.eq("status", filters.status)
  if (filters?.assigned_to) query = query.eq("assigned_to", filters.assigned_to)
  if (filters?.room_id) query = query.eq("room_id", filters.room_id)
  if (filters?.types && filters.types.length > 0) query = query.in("type", filters.types)

  const { data, error } = await query.limit(100)
  if (error) return failure(error.message)
  return success(data)
}

export async function getMyTasks() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return failure("Non autenticato")

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      *,
      room:room_id (id, name),
      booking:booking_id (id, booking_number, guest:guest_id (full_name), has_early_check_in)
    `)
    .or(`assigned_to.eq.${user.id},assigned_to.is.null`)
    .in("status", ["Pending", "InProgress"])
    .order("priority", { ascending: false })
    .order("due_date")

  if (error) return failure(error.message)
  return success(data)
}

export async function createTask(
  propertyId: string,
  values: {
    room_id?: string | null
    booking_id?: string | null
    assigned_to?: string | null
    type: string
    priority?: string
    title: string
    description?: string
    estimated_minutes?: number
    due_date?: string
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from("tasks")
    .insert({
      property_id: propertyId,
      ...values,
      created_by: user?.id,
    })

  if (error) return failure(error.message)
  revalidatePath("/housekeeping")
  revalidatePath("/tasks")
  return success(undefined)
}

export async function startTask(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("tasks")
    .update({ status: "InProgress", started_at: new Date().toISOString() })
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/housekeeping")
  return success(undefined)
}

export async function completeTask(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from("tasks")
    .update({
      status: "Completed",
      completed_at: new Date().toISOString(),
      completed_by: user?.id,
    })
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/housekeeping")
  revalidatePath("/rooms")
  return success(undefined)
}

export async function updateTask(
  id: string,
  values: {
    assigned_to?: string | null
    priority?: string
    status?: string
    title?: string
    description?: string
    estimated_minutes?: number | null
    due_date?: string | null
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("tasks")
    .update(values)
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/housekeeping")
  revalidatePath("/tasks")
  return success(undefined)
}

export async function cancelTask(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("tasks")
    .update({ status: "Cancelled" })
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/housekeeping")
  revalidatePath("/tasks")
  return success(undefined)
}
