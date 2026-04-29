"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"

type Result = { ok: true } | { ok: false; error: string }

export type QuickRoomState =
  | "Clean"
  | "Dirty"
  | "InProgress"
  | "Inspection"
  | "Maintenance"

/**
 * Set rapido di stato/pulizia camera dalla griglia.
 * - Clean / Dirty / InProgress / Inspection -> aggiorna cleaning_status
 * - Maintenance -> imposta status='Maintenance' (cleaning resta com'è)
 * - Available -> ripristina status='Available' (uscita da manutenzione)
 */
export async function setRoomQuickState(
  roomId: string,
  next: QuickRoomState | "Available",
): Promise<Result> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: "Non autenticato" }

  const update: Record<string, string> = {}
  if (next === "Maintenance") {
    update.status = "Maintenance"
  } else if (next === "Available") {
    update.status = "Available"
  } else {
    update.cleaning_status = next
    // se la camera era in manutenzione e cambi pulizia, riportala disponibile
    update.status = "Available"
  }

  const { error } = await supabase.from("rooms").update(update).eq("id", roomId)
  if (error) return { ok: false, error: error.message }

  revalidatePath("/rooms")
  revalidatePath("/dashboard")
  revalidatePath("/settings")
  return { ok: true }
}
