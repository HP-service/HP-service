import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import { SessionProvider } from "@providers/session-provider"
import { redirect } from "next/navigation"
import { MainShell } from "./main-shell"

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await requireRole(MAIN_APP_ROLES)

  // Onboarding gate: il primo Admin loggato deve completare il setup struttura
  if (!profile.property_id) {
    redirect("/onboarding")
  }

  return (
    <SessionProvider profile={profile}>
      <MainShell>{children}</MainShell>
    </SessionProvider>
  )
}
