"use client"

import { createContext, useContext } from "react"
import type { Profile } from "./server"

type SessionContextType = {
  profile: Profile
}

export const SessionContext = createContext<SessionContextType | null>(null)

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) {
    throw new Error("useSession must be used within a SessionProvider")
  }
  return ctx
}

export function useProfile() {
  return useSession().profile
}

export function useRole() {
  return useSession().profile.role
}
