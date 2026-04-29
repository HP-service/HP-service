import { getGuestSession, getPortalData } from "@db/queries/guest-portal"
import { redirect } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Wifi, Clock, Phone, FileText } from "lucide-react"
import { BottomNav } from "../_components/bottom-nav"
import { WhatsAppButton } from "../_components/whatsapp-button"

export default async function GuestInfoPage() {
  const session = await getGuestSession()
  if (!session) redirect("/guest")

  const { property } = await getPortalData(session.property_id)
  const settings = (property?.settings ?? {}) as Record<string, string>

  const wifiNetwork = settings.portal_wifi_network
  const wifiPassword = settings.portal_wifi_password
  const hotelInfo = settings.portal_hotel_info
  const whatsappNumber = settings.portal_whatsapp_number
  const checkOutTime = property?.check_out_time ?? "11:00"
  const hotelName = property?.name ?? "Hotel"

  return (
    <div className="pb-20">
      <div className="bg-gradient-to-br from-teal-600 to-teal-700 px-4 pb-6 pt-10 text-white">
        <h1 className="text-2xl font-bold">Info Hotel</h1>
        <p className="mt-1 text-sm opacity-80">{hotelName}</p>
      </div>

      <div className="space-y-4 px-4 pt-4">
        {/* WiFi */}
        {wifiNetwork && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Wifi className="h-4 w-4 text-blue-600" />
                WiFi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Rete</span>
                <span className="font-mono font-medium">{wifiNetwork}</span>
              </div>
              {wifiPassword && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Password</span>
                  <span className="font-mono font-medium">{wifiPassword}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Check-out time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-orange-600" />
              Orario Check-out
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {typeof checkOutTime === "string" ? checkOutTime.slice(0, 5) : checkOutTime}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Ricorda di liberare la camera entro questo orario
            </p>
          </CardContent>
        </Card>

        {/* Contact */}
        {whatsappNumber && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Phone className="h-4 w-4 text-green-600" />
                Contatti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <WhatsAppButton
                phoneNumber={whatsappNumber}
                message={`Salve, sono ${session.guest_name} nella camera ${session.room_name}. `}
                label="Contatta la Reception"
                className="w-full"
              />
            </CardContent>
          </Card>
        )}

        {/* Hotel info / rules */}
        {hotelInfo && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-slate-600" />
                Informazioni
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {hotelInfo}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
