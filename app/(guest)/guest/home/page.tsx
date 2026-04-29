import { getGuestSession, getPortalData } from "@db/queries/guest-portal"
import { redirect } from "next/navigation"
import { CalendarCheck, Sparkles, Compass, Info, MessageCircle } from "lucide-react"
import { Card, CardContent } from "@ui/card"
import Link from "next/link"
import { BottomNav } from "../_components/bottom-nav"
import { WhatsAppButton } from "../_components/whatsapp-button"

export default async function GuestHomePage() {
  const session = await getGuestSession()
  if (!session) redirect("/guest")

  const { property } = await getPortalData(session.property_id)
  const settings = (property?.settings ?? {}) as Record<string, string>
  const welcomeMsg = settings.portal_welcome_message
  const whatsappNumber = settings.portal_whatsapp_number

  return (
    <div className="pb-20">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 px-4 pb-8 pt-10 text-white">
        <p className="text-sm opacity-80">Camera {session.room_name}</p>
        <h1 className="text-2xl font-bold">Ciao, {session.guest_name}!</h1>
        {welcomeMsg && (
          <p className="mt-2 text-sm opacity-90">{welcomeMsg}</p>
        )}
        <div className="mt-3 flex items-center gap-2 text-sm opacity-80">
          <CalendarCheck className="h-4 w-4" />
          <span>Check-out: {session.check_out}</span>
        </div>
      </div>

      {/* Quick links */}
      <div className="px-4 -mt-4">
        <div className="grid grid-cols-2 gap-3">
          <Link href="/guest/services">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col items-center gap-2 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                  <Sparkles className="h-6 w-6 text-purple-600" />
                </div>
                <span className="text-sm font-medium">Servizi</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/guest/explore">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col items-center gap-2 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                  <Compass className="h-6 w-6 text-orange-600" />
                </div>
                <span className="text-sm font-medium">Esplora</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/guest/info">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col items-center gap-2 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
                  <Info className="h-6 w-6 text-teal-600" />
                </div>
                <span className="text-sm font-medium">Info Hotel</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/guest/concierge">
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col items-center gap-2 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <MessageCircle className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium">Concierge AI</span>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* WhatsApp CTA */}
        {whatsappNumber && (
          <div className="mt-6">
            <WhatsAppButton
              phoneNumber={whatsappNumber}
              message={`Salve, sono ${session.guest_name} nella camera ${session.room_name}. `}
              label="Contatta la Reception"
              className="w-full h-12 text-base border-green-200 hover:bg-green-50"
            />
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
