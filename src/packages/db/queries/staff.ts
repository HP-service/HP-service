"use server"

import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"

export async function createStaffUser(
  propertyId: string,
  values: {
    full_name: string
    email: string
    password: string
    role: string
  }
): Promise<ActionResult> {
  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.createUser({
    email: values.email,
    password: values.password,
    email_confirm: true,
    user_metadata: { full_name: values.full_name, role: values.role },
  })

  if (error) return failure(error.message)

  if (data.user) {
    await admin
      .from("profiles")
      .update({ property_id: propertyId, role: values.role as never })
      .eq("id", data.user.id)
  }

  revalidatePath("/settings")
  return success(undefined)
}

export async function updateStaffUser(
  userId: string,
  values: { full_name?: string; role?: string; is_active?: boolean }
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("profiles")
    .update(values)
    .eq("id", userId)

  if (error) return failure(error.message)
  revalidatePath("/settings")
  return success(undefined)
}
