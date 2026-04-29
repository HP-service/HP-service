import { redirect } from "next/navigation"
import { getCheckInData } from "@db/queries/checkin"
import { CheckInWizard } from "./_components/check-in-wizard"

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await getCheckInData(id)

  if (result.error || !result.data) {
    redirect(`/bookings/${id}`)
  }

  const { booking, bookingGuests, submissions, hasCredentials } = result.data

  // Verifica che il booking sia in stato Confirmed (o anche CheckedIn per retry)
  if (!["Confirmed", "CheckedIn"].includes(booking.status)) {
    redirect(`/bookings/${id}`)
  }

  // Verifica che abbia una camera assegnata
  if (!booking.room_id) {
    redirect(`/bookings/${id}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Check-in</h1>
        <p className="text-muted-foreground">
          {booking.booking_number} &mdash; Camera {(booking.room as { name: string } | null)?.name || "N/A"} &mdash;{" "}
          {booking.nights} {booking.nights === 1 ? "notte" : "notti"}
        </p>
      </div>

      <CheckInWizard
        booking={booking}
        existingBookingGuests={bookingGuests}
        existingSubmissions={submissions}
        hasCredentials={hasCredentials}
      />
    </div>
  )
}
