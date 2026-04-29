export const dynamic = "force-dynamic"

import Link from "next/link"
import { Button } from "@ui/button"
import { ArrowLeft } from "lucide-react"
import { getRoomTypes, getChannels } from "@db/queries/settings"
import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import { NewBookingForm } from "./_components/new-booking-form"

export default async function NewBookingPage() {
  const profile = await requireRole(MAIN_APP_ROLES)
  const [roomTypesResult, channelsResult] = await Promise.all([
    getRoomTypes(),
    getChannels(),
  ])

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/bookings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuova Prenotazione</h1>
          <p className="text-muted-foreground">Inserisci i dati della prenotazione</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <NewBookingForm
          propertyId={profile.property_id!}
          roomTypes={roomTypesResult.data ?? []}
          channels={channelsResult.data ?? []}
        />
      </div>
    </div>
  )
}
