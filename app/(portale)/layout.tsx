import { requireRole, PORTAL_ROLES } from "@auth/index"
import { SessionProvider } from "@providers/session-provider"
import { LogOut, DoorOpen } from "lucide-react"
import { signOut } from "@auth/server"

export default async function PortaleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await requireRole(PORTAL_ROLES)

  return (
    <SessionProvider profile={profile}>
      <div className="min-h-screen bg-muted/30">
        {/* Simple top bar for portal */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background px-4">
          <div className="flex items-center gap-2">
            <DoorOpen className="h-5 w-5 text-primary" />
            <span className="font-semibold">Staff · Housekeeping & Manutenzione</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {profile.full_name} ({profile.role})
            </span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                title="Esci"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="p-4">{children}</main>
      </div>
    </SessionProvider>
  )
}
