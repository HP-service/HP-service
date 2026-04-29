"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"

// ============================================
// Folio & Invoice Items
// ============================================

export async function getFolioForBooking(bookingId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("folios")
    .select(`
      *,
      invoice_items (*),
      transactions (*)
    `)
    .eq("booking_id", bookingId)
    .single()

  if (error) return failure(error.message)
  return success(data)
}

export async function addInvoiceItem(values: {
  folio_id: string
  description: string
  category?: string
  quantity?: number
  unit_price: number
  tax_rate?: number
  date?: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from("invoice_items")
    .insert({ ...values, created_by: user?.id })

  if (error) return failure(error.message)
  revalidatePath("/bookings")
  return success(undefined)
}

export async function deleteInvoiceItem(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("invoice_items")
    .delete()
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/bookings")
  return success(undefined)
}

// ============================================
// Transactions
// ============================================

export async function addTransaction(values: {
  folio_id: string
  amount: number
  method: string
  type?: string
  reference?: string
  notes?: string
}): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from("transactions")
    .insert({ ...values, recorded_by: user?.id })

  if (error) return failure(error.message)
  revalidatePath("/bookings")
  revalidatePath("/finance")
  return success(undefined)
}

export async function getTransactions(limit = 200) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("transactions")
    .select(`
      *,
      folio:folio_id (
        id,
        folio_number,
        booking:booking_id (
          id,
          booking_number,
          guest:guest_id (full_name)
        )
      ),
      recorded_by_profile:recorded_by (full_name)
    `)
    .order("date", { ascending: false })
    .limit(limit)

  if (error) return failure(error.message)
  return success(data)
}

// ============================================
// Expenses
// ============================================

export async function getExpenses(filters?: { from?: string; to?: string; category_id?: string; room_id?: string }) {
  const supabase = await createClient()
  let query = supabase
    .from("expenses")
    .select(`
      *,
      category:category_id (id, name, color),
      room:room_id (id, name),
      recorded_by_profile:recorded_by (full_name)
    `)
    .order("date", { ascending: false })
    .limit(200)

  if (filters?.from) query = query.gte("date", filters.from)
  if (filters?.to) query = query.lte("date", filters.to)
  if (filters?.category_id) query = query.eq("category_id", filters.category_id)
  if (filters?.room_id) query = query.eq("room_id", filters.room_id)

  const { data, error } = await query
  if (error) return failure(error.message)
  return success(data)
}

export async function createExpense(
  propertyId: string,
  values: {
    category_id: string
    description: string
    amount: number
    tax_amount?: number
    date: string
    vendor?: string
    room_id?: string | null
    notes?: string
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { error } = await supabase
    .from("expenses")
    .insert({
      property_id: propertyId,
      ...values,
      recorded_by: user?.id,
    })

  if (error) return failure(error.message)
  revalidatePath("/finance")
  return success(undefined)
}

export async function updateExpense(
  id: string,
  values: {
    category_id?: string
    description?: string
    amount?: number
    tax_amount?: number
    date?: string
    vendor?: string | null
    room_id?: string | null
    notes?: string | null
    status?: string
  }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("expenses")
    .update(values)
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/finance")
  revalidatePath("/finance/expenses")
  return success(undefined)
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", id)

  if (error) return failure(error.message)
  revalidatePath("/finance")
  revalidatePath("/finance/expenses")
  return success(undefined)
}

// ============================================
// Finance Stats
// ============================================

export async function getFinanceStats(month?: string) {
  const supabase = await createClient()
  const now = new Date()
  const targetMonth = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  const startDate = `${targetMonth}-01`
  const endDate = new Date(
    parseInt(targetMonth.split("-")[0]),
    parseInt(targetMonth.split("-")[1]),
    0
  ).toISOString().split("T")[0]

  // Revenue (transactions)
  const { data: txns } = await supabase
    .from("transactions")
    .select("amount, type")
    .gte("date", startDate)
    .lte("date", endDate + "T23:59:59")

  const revenue = (txns ?? [])
    .filter((t) => t.type !== "Refund")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const refunds = (txns ?? [])
    .filter((t) => t.type === "Refund")
    .reduce((sum, t) => sum + Number(t.amount), 0)

  // Expenses
  const { data: exps } = await supabase
    .from("expenses")
    .select("amount, status")
    .gte("date", startDate)
    .lte("date", endDate)
    .in("status", ["Approved", "Paid"])

  const expenses = (exps ?? []).reduce((sum, e) => sum + Number(e.amount), 0)

  return success({
    revenue,
    refunds,
    expenses,
    netRevenue: revenue - refunds,
    grossProfit: revenue - refunds - expenses,
    month: targetMonth,
  })
}
