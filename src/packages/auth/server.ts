"use server"

import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { UserRole } from "@db/enums"

export type Profile = {
  id: string
  full_name: string
  email: string
  phone: string | null
  role: UserRole
  property_id: string | null
  avatar_url: string | null
  is_active: boolean
}

export async function getSession() {
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session
}

export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getProfile(): Promise<Profile | null> {
  const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL || 
                 process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project")

  if (isMock) {
    console.log("⚠️ MOCK MODE ACTIVATED: Returning dummy Admin profile.")
    return {
      id: "mock-admin-id",
      full_name: "Mock Admin",
      email: "admin@test.com",
      phone: null,
      role: "Manager",
      property_id: "mock-property-id",
      avatar_url: null,
      is_active: true
    } as Profile
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return profile
}

export async function requireAuth(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect("/login")
  if (!profile.is_active) redirect("/login?error=disabled")
  return profile
}

export async function requireRole(allowedRoles: UserRole[]): Promise<Profile> {
  const profile = await requireAuth()
  if (!allowedRoles.includes(profile.role)) {
    redirect("/login?error=unauthorized")
  }
  return profile
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
