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

  // Chiama la funzione SECURITY DEFINER che bypassa RLS per il setup iniziale.
  // Vedi: supabase-fix-onboarding.sql
  const { data: propertyId, error: rpcErr } = await supabase.rpc("setup_property", {
    p_name: data.name,
    p_address: data.address,
    p_city: data.city,
    p_postal_code: data.postal_code,
    p_province: data.province || "",
    p_country: data.country || "IT",
    p_vat_number: data.vat_number || "",
    p_cin_code: data.cin_code || "",
    p_phone: data.phone || "",
    p_email: data.email || "",
    p_full_name: data.full_name,
  })

  if (rpcErr || !propertyId) {
    return {
      ok: false,
      error:
        rpcErr?.message ??
        "Impossibile creare la struttura. Hai eseguito supabase-fix-onboarding.sql?",
    }
  }

  revalidatePath("/", "layout")
  return { ok: true, propertyId: propertyId as string }
}
