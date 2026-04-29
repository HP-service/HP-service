"use client"

import { SessionContext } from "@auth/client"
import type { Profile } from "@auth/server"
import type { ReactNode } from "react"

export function SessionProvider({
  children,
  profile,
}: {
  children: ReactNode
  profile: Profile
}) {
  return (
    <SessionContext.Provider value={{ profile }}>
      {children}
    </SessionContext.Provider>
  )
}
