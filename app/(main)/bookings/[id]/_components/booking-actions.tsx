"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"
import { Button } from "@ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { changeBookingStatus, updateBooking } from "@db/queries/bookings"
import { getStatusLabel } from "@db/functions/booking-state"
import type { BookingStatus } from "@db/enums"

type Props = {
  bookingId: string
  currentStatus: BookingStatus
  currentRoomId: string | null
  availableTransitions: BookingStatus[]
  assignableRooms: { id: string; name: string }[]
}

const STATUS_ACTION_LABELS: Partial<Record<BookingStatus, string>> = {
  Confirmed: "Conferma",
  CheckedIn: "Esegui Check-in",
  CheckedOut: "Esegui Check-out",
  Cancelled: "Cancella",
  NoShow: "Segna No-show",
}

const STATUS_ACTION_VARIANTS: Partial<Record<BookingStatus, "default" | "destructive" | "secondary">> = {
  Confirmed: "secondary",
  CheckedIn: "default",
  CheckedOut: "secondary",
  Cancelled: "destructive",
  NoShow: "destructive",
}

export function BookingActions({ bookingId, currentStatus, currentRoomId, availableTransitions, assignableRooms }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [selectedRoom, setSelectedRoom] = useState(currentRoomId ?? "")
  const [cancellationReason, setCancellationReason] = useState("")

  if (availableTransitions.length === 0 && currentRoomId) {
    return null
  }

  function handleTransition(newStatus: BookingStatus) {
    if (newStatus === "CheckedIn" && !currentRoomId && !selectedRoom) {
      toast.error("Seleziona una camera prima del check-in")
      return
    }
    if (newStatus === "Cancelled" && !cancellationReason) {
      toast.error("Inserisci il motivo di cancellazione")
      return
    }

    startTransition(async () => {
      // Assign room first if needed
      if (selectedRoom && selectedRoom !== currentRoomId) {
        await updateBooking(bookingId, { room_id: selectedRoom })
      }

      const result = await changeBookingStatus(bookingId, newStatus, {
        room_id: selectedRoom || undefined,
        cancellation_reason: cancellationReason || undefined,
      })

      if (result.error) toast.error(result.error)
      else {
        toast.success(`Stato aggiornato: ${getStatusLabel(newStatus)}`)
        router.refresh()
      }
    })
  }

  function handleAssignRoom() {
    if (!selectedRoom) return
    startTransition(async () => {
      const result = await updateBooking(bookingId, { room_id: selectedRoom })
      if (result.error) toast.error(result.error)
      else {
        toast.success("Camera assegnata")
        router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Azioni</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Room assignment if not assigned */}
        {!currentRoomId && assignableRooms.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm">Assegna camera</Label>
            <div className="flex gap-2">
              <Select value={selectedRoom} onValueChange={setSelectedRoom}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleziona camera..." />
                </SelectTrigger>
                <SelectContent>
                  {assignableRooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>Camera {r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" variant="outline" onClick={handleAssignRoom} disabled={!selectedRoom || isPending}>
                Assegna
              </Button>
            </div>
          </div>
        )}

        {/* Cancellation reason */}
        {availableTransitions.includes("Cancelled") && (
          <div className="space-y-1.5">
            <Label className="text-sm">Motivo cancellazione</Label>
            <Input
              placeholder="Motivo obbligatorio per cancellare"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
            />
          </div>
        )}

        {/* Transition buttons */}
        {availableTransitions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {availableTransitions.map((status) =>
              status === "CheckedIn" ? (
                <Button key={status} variant="default" asChild disabled={!currentRoomId && !selectedRoom}>
                  <Link href={`/bookings/${bookingId}/check-in`}>
                    Esegui Check-in
                  </Link>
                </Button>
              ) : (
                <Button
                  key={status}
                  variant={STATUS_ACTION_VARIANTS[status] ?? "secondary"}
                  disabled={isPending}
                  onClick={() => handleTransition(status)}
                >
                  {STATUS_ACTION_LABELS[status] ?? getStatusLabel(status)}
                </Button>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
