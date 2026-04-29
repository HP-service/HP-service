"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"

// ============================================
// Portal Services CRUD
// ============================================

export async function getPortalServices(propertyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("portal_services")
    .select("*")
    .eq("property_id", propertyId)
    .order("sort_order")

  if (error) return failure(error.message)
  return success(data)
}

export async function createPortalService(
  propertyId: string,
  values: {
    name: string
    description?: string
    category: string
    price?: number | null
    image_url?: string
    sort_order?: number
    is_active?: boolean
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("portal_services")
    .insert({ property_id: propertyId, ...values })

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

export async function updatePortalService(
  id: string,
  values: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("portal_services")
    .update(values)
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

export async function deletePortalService(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("portal_services")
    .delete()
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

// ============================================
// Portal Attractions CRUD
// ============================================

export async function getPortalAttractions(propertyId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("portal_attractions")
    .select("*")
    .eq("property_id", propertyId)
    .order("sort_order")

  if (error) return failure(error.message)
  return success(data)
}

export async function createPortalAttraction(
  propertyId: string,
  values: {
    name: string
    description?: string
    category: string
    image_url?: string
    external_url?: string
    sort_order?: number
    is_active?: boolean
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("portal_attractions")
    .insert({ property_id: propertyId, ...values })

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

export async function updatePortalAttraction(
  id: string,
  values: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("portal_attractions")
    .update(values)
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

export async function deletePortalAttraction(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("portal_attractions")
    .delete()
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}

// ============================================
// Portal Settings (properties.settings JSONB)
// ============================================

export async function savePortalSettings(
  propertyId: string,
  values: Record<string, unknown>
): Promise<ActionResult> {
  const supabase = await createClient()

  // Read current settings and merge
  const { data: property, error: readErr } = await supabase
    .from("properties")
    .select("settings")
    .eq("id", propertyId)
    .single()

  if (readErr) return failure(readErr.message)

  const currentSettings = (property?.settings ?? {}) as Record<string, unknown>
  const merged = { ...currentSettings, ...values }

  const { error } = await supabase
    .from("properties")
    .update({ settings: merged })
    .eq("id", propertyId)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}
