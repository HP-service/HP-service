export const dynamic = "force-dynamic"

import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import {
  getIcalSubscriptions,
  getRoomsForIcal,
  getChannelsForIcal,
} from "@db/queries/ical"
import { IcalClient } from "./_components/client"
import { RefreshCw } from "lucide-react"

export default async function IcalPage() {
  await requireRole(MAIN_APP_ROLES)

  const [subsRes, roomsRes, channelsRes] = await Promise.all([
    getIcalSubscriptions(),
    getRoomsForIcal(),
    getChannelsForIcal(),
  ])

  const subscriptions = subsRes.data ?? []
  const rooms = roomsRes.data ?? []
  const channels = channelsRes.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200">
            <RefreshCw className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
              iCal Sync
            </h1>
            <p className="text-sm text-slate-500">
              Sincronizza prenotazioni da Booking.com, Airbnb, Expedia. Sync
              automatico ogni 30 minuti.
            </p>
          </div>
        </div>
      </div>

      <IcalClient
        initialSubscriptions={subscriptions}
        rooms={rooms}
        channels={channels}
      />
    </div>
  )
}
