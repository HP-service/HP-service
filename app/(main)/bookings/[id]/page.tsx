export const dynamic = "force-dynamic"

import Link from "next/link"
import { notFound } from "next/navigation"
import { getBooking } from "@db/queries/bookings"
import { getFolioForBooking } from "@db/queries/finance"
import { getRooms } from "@db/queries/settings"
import { Button } from "@ui/button"
import { Badge } from "@ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Separator } from "@ui/separator"
import { ArrowLeft, KeyRound } from "lucide-react"
import { getStatusLabel, getAvailableTransitions } from "@db/functions/booking-state"
import type { BookingStatus } from "@db/enums"
import { BookingActions } from "./_components/booking-actions"
import { BookingEditDelete } from "./_components/booking-edit-delete"
import { FolioSection } from "./_components/folio-section"
import { GuestAccessCodeCard } from "./_components/guest-access-code"

const STATUS_BADGE_CLASSES: Record<string, string> = {
  Inquiry:    "bg-yellow-100 text-yellow-800 border-yellow-200",
  Confirmed:  "bg-indigo-100 text-indigo-800 border-indigo-200",
  CheckedIn:  "bg-green-100 text-green-800 border-green-200",
  CheckedOut: "bg-slate-100 text-slate-800 border-slate-200",
  Cancelled:  "bg-red-100 text-red-800 border-red-200",
  NoShow:     "bg-orange-100 text-orange-800 border-orange-200",
}

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [bookingResult, folioResult, roomsResult] = await Promise.all([
    getBooking(id),
    getFolioForBooking(id),
    getRooms(),
  ])

  if (bookingResult.error || !bookingResult.data) notFound()

  const booking = bookingResult.data
  const folio = folioResult.data
  const rooms = roomsResult.data ?? []

  // Supabase PostgREST può restituire array o oggetto singolo per i join
  type GuestJoin = { id: string; full_name: string; email: string | null; phone: string | null }
  const guestRaw = booking.guest
  const guest: GuestJoin | null =
    Array.isArray(guestRaw) ? (guestRaw[0] ?? null) : (guestRaw as GuestJoin | null)

  type RoomTypeJoin = { name: string; short_code: string | null }
  const roomTypeRaw = booking.room_type
  const roomType: RoomTypeJoin | null =
    Array.isArray(roomTypeRaw) ? (roomTypeRaw[0] ?? null) : (roomTypeRaw as RoomTypeJoin | null)

  type RoomJoin = { name: string }
  const roomRaw = booking.room
  const room: RoomJoin | null =
    Array.isArray(roomRaw) ? (roomRaw[0] ?? null) : (roomRaw as RoomJoin | null)

  type ChannelJoin = { name: string; commission_rate: number }
  const channelRaw = booking.channel
  const channel: ChannelJoin | null =
    Array.isArray(channelRaw) ? (channelRaw[0] ?? null) : (channelRaw as ChannelJoin | null)

  const availableTransitions = getAvailableTransitions(booking.status as BookingStatus)

  // Rooms available to assign (pass all rooms of this room_type)
  const assignableRooms = rooms
    .filter((r) => r.room_type_assignments?.some((a: { room_type_id: string }) => a.room_type_id === booking.room_type_id))
    .map((r) => ({ id: r.id, name: r.name }))

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/bookings">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{booking.booking_number}</h1>
            <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${STATUS_BADGE_CLASSES[booking.status] ?? ""}`}>
              {getStatusLabel(booking.status as BookingStatus)}
            </span>
          </div>
          <p className="text-muted-foreground">
            {booking.check_in} → {booking.check_out} · {booking.nights} notti
          </p>
        </div>
        <BookingEditDelete
          bookingId={booking.id}
          bookingNumber={booking.booking_number}
          initial={{
            check_in: booking.check_in,
            check_out: booking.check_out,
            adults: booking.adults,
            children: booking.children,
            total_amount: booking.total_amount,
            special_requests: booking.special_requests,
            internal_notes: booking.internal_notes,
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-4 lg:col-span-1">
          {/* Guest info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Ospite</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {guest ? (
                <>
                  {guest.id ? (
                    <Link href={`/guests/${guest.id}`} className="font-medium hover:underline">
                      {guest.full_name}
                    </Link>
                  ) : (
                    <span className="font-medium">{guest.full_name}</span>
                  )}
                  {guest.email && <p className="text-muted-foreground">{guest.email}</p>}
                  {guest.phone && <p className="text-muted-foreground">{guest.phone}</p>}
                </>
              ) : (
                <p className="text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>

          {/* Room info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Camera</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Tipologia: </span>
                <span className="font-medium">{roomType?.name ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Camera: </span>
                <span className="font-medium">{room?.name ?? "Non assegnata"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Ospiti: </span>
                <span>{booking.adults} adulti{booking.children > 0 ? `, ${booking.children} bambini` : ""}</span>
              </div>
            </CardContent>
          </Card>

          {/* Channel & amounts */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Finanziario</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Canale: </span>
                <span>{channel?.name ?? "—"}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Importo totale: </span>
                <span className="font-medium">€{Number(booking.total_amount ?? 0).toFixed(2)}</span>
              </div>
              {channel?.commission_rate && (
                <div>
                  <span className="text-muted-foreground">Commissione ({channel.commission_rate}%): </span>
                  <span className="text-destructive">
                    -€{(Number(booking.total_amount ?? 0) * channel.commission_rate / 100).toFixed(2)}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Flags */}
          {(booking.has_early_check_in || booking.has_late_check_out || booking.special_requests) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Extra / Richieste</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {booking.has_early_check_in && <Badge variant="secondary">Early Check-in</Badge>}
                {booking.has_late_check_out && <Badge variant="secondary">Late Check-out</Badge>}
                {booking.special_requests && (
                  <p className="text-muted-foreground">{booking.special_requests}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4 lg:col-span-2">
          {/* State machine actions */}
          <BookingActions
            bookingId={booking.id}
            currentStatus={booking.status as BookingStatus}
            currentRoomId={booking.room_id}
            availableTransitions={availableTransitions}
            assignableRooms={assignableRooms}
          />

          {/* Guest Access Code (visible only when CheckedIn) */}
          {booking.status === "CheckedIn" && (
            <GuestAccessCodeCard
              bookingId={booking.id}
              accessCode={booking.guest_access_code}
              roomName={room?.name}
            />
          )}

          {/* Folio / Billing */}
          {folio && (
            <FolioSection folio={folio} bookingId={booking.id} />
          )}

          {/* Internal notes */}
          {booking.internal_notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Note interne</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{booking.internal_notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
