export const dynamic = "force-dynamic"

import { getRooms } from "@db/queries/settings"
import { getBookingsForPlanning } from "@db/queries/bookings"
import { TapeChart } from "./_components/tape-chart"

export default async function PlanningPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string }>
}) {
  const { start } = await searchParams

  // Default: start of current week
  const today = new Date()
  const startDate = start ?? today.toISOString().split("T")[0]
  const endDate = new Date(new Date(startDate).getTime() + 30 * 86400000).toISOString().split("T")[0]

  const [roomsResult, bookingsResult] = await Promise.all([
    getRooms(),
    getBookingsForPlanning(startDate, endDate),
  ])

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Planning</h1>
        <p className="text-muted-foreground">Calendario prenotazioni e disponibilità camere</p>
      </div>

      <TapeChart
        rooms={(roomsResult.data ?? []) as unknown as Parameters<typeof TapeChart>[0]["rooms"]}
        bookings={(bookingsResult.data ?? []) as unknown as Parameters<typeof TapeChart>[0]["bookings"]}
        startDate={startDate}
      />
    </div>
  )
}
