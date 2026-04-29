import { requireAuth } from "@auth/server"
import { redirect } from "next/navigation"

export default async function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const profile = await requireAuth()

  // Se ha già una property, rimanda dove deve stare
  if (profile.property_id) {
    redirect("/dashboard")
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-white to-indigo-50/40">
      <div className="pointer-events-none absolute -left-40 top-0 h-[500px] w-[500px] rounded-full bg-indigo-200/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-[500px] w-[500px] rounded-full bg-violet-200/30 blur-3xl" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
