"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

export type InfoPage = {
  id: string
  slug: string
  title: string
  icon: string
  content: string
  sort_order: number
  is_active: boolean
  updated_at: string
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string }

async function getPropertyId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: p } = await supabase
    .from("profiles")
    .select("property_id")
    .eq("id", user.id)
    .single()
  return p?.property_id ?? null
}

export async function listInfoPages(): Promise<Result<InfoPage[]>> {
  const supabase = await createClient()
  const pid = await getPropertyId()
  if (!pid) return { ok: false, error: "Non autenticato" }
  const { data, error } = await supabase
    .from("info_pages")
    .select("id, slug, title, icon, content, sort_order, is_active, updated_at")
    .eq("property_id", pid)
    .order("sort_order")
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: (data ?? []) as InfoPage[] }
}

export async function getInfoPage(id: string): Promise<Result<InfoPage>> {
  const supabase = await createClient()
  const pid = await getPropertyId()
  if (!pid) return { ok: false, error: "Non autenticato" }
  const { data, error } = await supabase
    .from("info_pages")
    .select("id, slug, title, icon, content, sort_order, is_active, updated_at")
    .eq("property_id", pid)
    .eq("id", id)
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Non trovata" }
  return { ok: true, data: data as InfoPage }
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60)
}

export async function upsertInfoPage(input: {
  id?: string
  title: string
  icon?: string
  content: string
  is_active?: boolean
  sort_order?: number
}): Promise<Result<{ id: string }>> {
  const supabase = await createClient()
  const pid = await getPropertyId()
  if (!pid) return { ok: false, error: "Non autenticato" }
  if (!input.title.trim()) return { ok: false, error: "Titolo obbligatorio" }

  if (input.id) {
    const { error } = await supabase
      .from("info_pages")
      .update({
        title: input.title,
        icon: input.icon || "info",
        content: input.content,
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.id)
      .eq("property_id", pid)
    if (error) return { ok: false, error: error.message }
    revalidatePath("/info-ospiti")
    return { ok: true, data: { id: input.id } }
  }

  const slug = slugify(input.title) || `info-${Date.now()}`
  const { data, error } = await supabase
    .from("info_pages")
    .insert({
      property_id: pid,
      slug,
      title: input.title,
      icon: input.icon || "info",
      content: input.content,
      is_active: input.is_active ?? true,
      sort_order: input.sort_order ?? 0,
    })
    .select("id")
    .single()
  if (error || !data) return { ok: false, error: error?.message ?? "Errore" }
  revalidatePath("/info-ospiti")
  return { ok: true, data: { id: data.id } }
}

export async function deleteInfoPage(id: string): Promise<Result<null>> {
  const supabase = await createClient()
  const pid = await getPropertyId()
  if (!pid) return { ok: false, error: "Non autenticato" }
  const { error } = await supabase
    .from("info_pages")
    .delete()
    .eq("id", id)
    .eq("property_id", pid)
  if (error) return { ok: false, error: error.message }
  revalidatePath("/info-ospiti")
  return { ok: true, data: null }
}

