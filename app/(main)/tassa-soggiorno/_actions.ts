"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"

export type TaxPayment = {
  id: string
  period_month: string
  amount: number
  paid_at: string
  payment_method: string | null
  reference: string | null
  notes: string | null
  receipt_url: string | null
  created_at: string
}

export async function listTaxPayments(): Promise<ActionResult<TaxPayment[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return failure("Non autenticato")

  const { data, error } = await supabase
    .from("tourist_tax_payments")
    .select("*")
    .order("period_month", { ascending: false })

  if (error) return failure(error.message)
  return success((data ?? []) as TaxPayment[])
}

export async function recordTaxPayment(values: {
  period_month: string
  amount: number
  paid_at: string
  payment_method?: string
  reference?: string
  notes?: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return failure("Non autenticato")

  const { data: profile } = await supabase
    .from("profiles")
    .select("property_id")
    .eq("id", user.id)
    .single()

  if (!profile?.property_id) return failure("Property non trovata")

  const { error } = await supabase.from("tourist_tax_payments").upsert(
    {
      property_id: profile.property_id,
      period_month: values.period_month,
      amount: values.amount,
      paid_at: values.paid_at,
      payment_method: values.payment_method ?? "F24",
      reference: values.reference,
      notes: values.notes,
      created_by: user.id,
    },
    { onConflict: "property_id,period_month" }
  )

  if (error) return failure(error.message)
  revalidatePath("/tassa-soggiorno")
  return success(undefined)
}

export async function deleteTaxPayment(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from("tourist_tax_payments").delete().eq("id", id)
  if (error) return failure(error.message)
  revalidatePath("/tassa-soggiorno")
  return success(undefined)
}

export async function isMonthPaid(month: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("tourist_tax_payments")
    .select("id")
    .eq("period_month", month)
    .maybeSingle()
  return !!data
}
