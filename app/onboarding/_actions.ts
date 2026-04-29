"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { z } from "zod"

const setupSchema = z.object({
  // Property
  name: z.string().min(2, "Nome troppo corto").max(120),
  address: z.string().min(3).max(200),
  city: z.string().min(2).max(80),
  postal_code: z.string().min(3).max(15),
  province: z.string().max(5).optional().or(z.literal("")),
  country: z.string().min(2).max(60).default("Italia"),
  vat_number: z.string().max(20).optional().or(z.literal("")),
  cin_code: z.string().max(20).optional().or(z.literal("")),
  phone: z.string().max(30).optional().or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  // User
  full_name: z.string().min(2).max(120),
})

export type SetupInput = z.infer<typeof setupSchema>

export async function completeSetup(input: SetupInput): Promise<
  { ok: true; propertyId: string } | { ok: false; error: string }
> {
  const parsed = setupSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dati non validi" }
  }
  const data = parsed.data

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Non autenticato" }

  // Verifica che il profilo non abbia già una property (idempotenza)
  const { data: existing } = await supabase
    .from("profiles")
    .select("property_id")
    .eq("id", user.id)
    .single()

  if (existing?.property_id) {
    return { ok: true, propertyId: existing.property_id }
  }

  // Crea property
  const { data: property, error: propErr } = await supabase
    .from("properties")
    .insert({
      name: data.name,
      address: data.address,
      city: data.city,
      postal_code: data.postal_code,
      province: data.province || null,
      country: data.country || "Italia",
      vat_number: data.vat_number || null,
      cin_code: data.cin_code || null,
      phone: data.phone || null,
      email: data.email || null,
    })
    .select("id")
    .single()

  if (propErr || !property) {
    return { ok: false, error: propErr?.message || "Impossibile creare la struttura" }
  }

  // Aggiorna profilo: collega property + nome + ruolo Manager
  const { error: profErr } = await supabase
    .from("profiles")
    .update({
      property_id: property.id,
      full_name: data.full_name,
      role: "Manager",
      is_active: true,
      email: user.email ?? "",
    })
    .eq("id", user.id)

  if (profErr) {
    return { ok: false, error: profErr.message }
  }

  revalidatePath("/", "layout")
  return { ok: true, propertyId: property.id }
}
