import { getGuestSession } from "@db/queries/guest-portal"
import { redirect } from "next/navigation"
import { Bot } from "lucide-react"
import { BottomNav } from "../_components/bottom-nav"
import { ChatUI } from "../_components/chat-ui"

export default async function GuestConciergePage() {
  const session = await getGuestSession()
  if (!session) redirect("/guest")

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-white px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
          <Bot className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h1 className="font-semibold">Concierge Virtuale</h1>
          <p className="text-xs text-muted-foreground">
            Chiedi informazioni su hotel, servizi e zona
          </p>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden pb-16">
        <ChatUI guestName={session.guest_name} />
      </div>

      <BottomNav />
    </div>
  )
}
