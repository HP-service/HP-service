"use client"

import { useState, useTransition, useEffect } from "react"
import { useForm } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Search, CheckCircle, AlertCircle } from "lucide-react"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { Switch } from "@ui/switch"
import { Separator } from "@ui/separator"
import { createBooking, checkAvailabilityAction, getAvailableRoomsForType } from "@db/queries/bookings"
import { getGuests, createGuest } from "@db/queries/guests"
import { bookingSchema, bookingBaseSchema } from "@db/schema"

type RoomType = { id: string; name: string; short_code: string | null; base_price: number }
type Channel = { id: string; name: string; commission_rate: number }
type GuestOption = { id: string; full_name: string; email: string | null }
type AvailableRoom = { id: string; name: string }

type Props = {
  propertyId: string
  roomTypes: RoomType[]
  channels: Channel[]
}

type FormValues = z.infer<typeof bookingBaseSchema>

export function NewBookingForm({ propertyId, roomTypes, channels }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [guestSearch, setGuestSearch] = useState("")
  const [guestOptions, setGuestOptions] = useState<GuestOption[]>([])
  const [selectedGuest, setSelectedGuest] = useState<GuestOption | null>(null)
  const [showGuestSearch, setShowGuestSearch] = useState(true)
  const [availability, setAvailability] = useState<number | null>(null)
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([])
  const [checkingAvail, setCheckingAvail] = useState(false)

  const form = useForm<FormValues>({
    // Cast needed: z.coerce fields have input type `unknown` in ZodEffects,
    // which conflicts with react-hook-form's Resolver generic in strict mode.
    resolver: zodResolver(bookingSchema) as unknown as Resolver<FormValues>,
    defaultValues: {
      guest_id: "",
      room_type_id: "",
      room_id: null,
      channel_id: null,
      check_in: "",
      check_out: "",
      adults: 1,
      children: 0,
      total_amount: 0,
      has_early_check_in: false,
      has_late_check_out: false,
      special_requests: "",
      internal_notes: "",
    },
  })

  const watchedRoomTypeId = form.watch("room_type_id")
  const watchedCheckIn = form.watch("check_in")
  const watchedCheckOut = form.watch("check_out")

  // Search guests
  useEffect(() => {
    if (!guestSearch || guestSearch.length < 2) {
      setGuestOptions([])
      return
    }
    const timeout = setTimeout(async () => {
      const res = await getGuests(guestSearch)
      setGuestOptions(res.data?.slice(0, 8) ?? [])
    }, 300)
    return () => clearTimeout(timeout)
  }, [guestSearch])

  // Check availability when type + dates change
  useEffect(() => {
    if (!watchedRoomTypeId || !watchedCheckIn || !watchedCheckOut) {
      setAvailability(null)
      setAvailableRooms([])
      return
    }
    setCheckingAvail(true)
    const run = async () => {
      const [availRes, roomsRes] = await Promise.all([
        checkAvailabilityAction(propertyId, watchedRoomTypeId, watchedCheckIn, watchedCheckOut),
        getAvailableRoomsForType(propertyId, watchedRoomTypeId, watchedCheckIn, watchedCheckOut),
      ])
      setAvailability(availRes.data ?? 0)
      setAvailableRooms(roomsRes.data ?? [])
      setCheckingAvail(false)

      // Auto-calculate amount (con validazione date)
      const roomType = roomTypes.find((rt) => rt.id === watchedRoomTypeId)
      if (roomType && watchedCheckIn && watchedCheckOut) {
        const tIn = new Date(watchedCheckIn).getTime()
        const tOut = new Date(watchedCheckOut).getTime()
        if (!Number.isNaN(tIn) && !Number.isNaN(tOut) && tOut > tIn) {
          const nights = Math.max(1, Math.round((tOut - tIn) / 86400000))
          form.setValue("total_amount", roomType.base_price * nights)
        }
      }
    }
    run()
  }, [watchedRoomTypeId, watchedCheckIn, watchedCheckOut, propertyId, roomTypes, form])

  function selectGuest(g: GuestOption) {
    setSelectedGuest(g)
    form.setValue("guest_id", g.id)
    setShowGuestSearch(false)
    setGuestSearch("")
    setGuestOptions([])
  }

  function onSubmit(values: FormValues) {
    // Se ci sono camere disponibili, la selezione è obbligatoria
    if (availableRooms.length > 0 && !values.room_id) {
      toast.error("Seleziona una camera prima di creare la prenotazione")
      return
    }
    startTransition(async () => {
      const result = await createBooking({ property_id: propertyId, ...values })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Prenotazione ${result.data?.booking_number} creata`)
        router.push(`/bookings/${result.data?.id}`)
      }
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Step 1: Guest */}
      <div className="space-y-3">
        <h3 className="font-medium">1. Ospite</h3>

        {selectedGuest ? (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
              {selectedGuest.full_name.charAt(0)}
            </div>
            <div className="flex-1">
              <p className="font-medium text-sm">{selectedGuest.full_name}</p>
              {selectedGuest.email && <p className="text-xs text-muted-foreground">{selectedGuest.email}</p>}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedGuest(null); form.setValue("guest_id", ""); setShowGuestSearch(true) }}>
              Cambia
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Cerca ospite per nome o email..."
                value={guestSearch}
                onChange={(e) => setGuestSearch(e.target.value)}
              />
            </div>
            {guestOptions.length > 0 && (
              <div className="rounded-lg border bg-popover shadow-md overflow-hidden">
                {guestOptions.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2"
                    onClick={() => selectGuest(g)}
                  >
                    <span className="font-medium">{g.full_name}</span>
                    {g.email && <span className="text-muted-foreground text-xs">{g.email}</span>}
                  </button>
                ))}
              </div>
            )}
            {form.formState.errors.guest_id && (
              <p className="text-xs text-destructive">{form.formState.errors.guest_id.message}</p>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Step 2: Dates + Room Type */}
      <div className="space-y-3">
        <h3 className="font-medium">2. Date e Tipologia</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Check-in *</Label>
            <Input type="date" {...form.register("check_in")} />
            {form.formState.errors.check_in && (
              <p className="text-xs text-destructive">{form.formState.errors.check_in.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Check-out *</Label>
            <Input type="date" {...form.register("check_out")} />
            {form.formState.errors.check_out && (
              <p className="text-xs text-destructive">{form.formState.errors.check_out.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Tipologia camera *</Label>
          <Select
            value={form.watch("room_type_id")}
            onValueChange={(v) => { form.setValue("room_type_id", v); form.setValue("room_id", null) }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona tipologia..." />
            </SelectTrigger>
            <SelectContent>
              {roomTypes.map((rt) => (
                <SelectItem key={rt.id} value={rt.id}>
                  {rt.name}{rt.short_code ? ` (${rt.short_code})` : ""} — €{rt.base_price}/notte
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {form.formState.errors.room_type_id && (
            <p className="text-xs text-destructive">{form.formState.errors.room_type_id.message}</p>
          )}
        </div>

        {/* Availability feedback */}
        {watchedRoomTypeId && watchedCheckIn && watchedCheckOut && (
          <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
            checkingAvail ? "bg-muted text-muted-foreground" :
            availability === 0 ? "bg-red-50 text-red-700 border border-red-200" :
            "bg-green-50 text-green-700 border border-green-200"
          }`}>
            {checkingAvail ? (
              <span>Verifica disponibilità...</span>
            ) : availability === 0 ? (
              <>
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Nessuna camera disponibile per queste date</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 shrink-0" />
                <span>{availability} camera{availability !== 1 ? "e" : ""} disponibile{availability !== 1 ? "i" : ""}</span>
              </>
            )}
          </div>
        )}

        {/* Room assignment — obbligatoria quando ci sono camere disponibili */}
        {availableRooms.length > 0 && (
          <div className="space-y-1.5">
            <Label>Camera *</Label>
            <Select
              value={form.watch("room_id") ?? ""}
              onValueChange={(v) => form.setValue("room_id", v || null)}
            >
              <SelectTrigger className={!form.watch("room_id") && form.formState.isSubmitted ? "border-destructive" : ""}>
                <SelectValue placeholder="Seleziona camera..." />
              </SelectTrigger>
              <SelectContent>
                {availableRooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>Camera {r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!form.watch("room_id") && form.formState.isSubmitted && (
              <p className="text-xs text-destructive">Seleziona una camera specifica</p>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Step 3: Details */}
      <div className="space-y-3">
        <h3 className="font-medium">3. Dettagli</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Adulti</Label>
            <Input type="number" min={1} {...form.register("adults")} />
          </div>
          <div className="space-y-1.5">
            <Label>Bambini</Label>
            <Input type="number" min={0} {...form.register("children")} />
          </div>
          <div className="space-y-1.5">
            <Label>Importo totale (€)</Label>
            <Input type="number" step="0.01" min={0} {...form.register("total_amount")} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Canale</Label>
          <Select
            value={form.watch("channel_id") ?? ""}
            onValueChange={(v) => form.setValue("channel_id", v || null)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleziona canale..." />
            </SelectTrigger>
            <SelectContent>
              {channels.map((ch) => (
                <SelectItem key={ch.id} value={ch.id}>
                  {ch.name}{ch.commission_rate > 0 ? ` (${ch.commission_rate}%)` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Early check-in</Label>
            <Switch
              checked={form.watch("has_early_check_in")}
              onCheckedChange={(v) => form.setValue("has_early_check_in", v)}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label>Late check-out</Label>
            <Switch
              checked={form.watch("has_late_check_out")}
              onCheckedChange={(v) => form.setValue("has_late_check_out", v)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Richieste speciali</Label>
          <Input {...form.register("special_requests")} placeholder="Es. piano alto, letto king..." />
        </div>

        <div className="space-y-1.5">
          <Label>Note interne</Label>
          <Input {...form.register("internal_notes")} placeholder="Note visibili solo allo staff" />
        </div>

        <div className="space-y-1.5">
          <Label>Rif. esterno (OTA)</Label>
          <Input {...form.register("external_ref")} placeholder="Numero conferma OTA" />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Annulla
        </Button>
        <Button
          type="submit"
          disabled={
            isPending ||
            availability === 0 ||
            !selectedGuest ||
            (availableRooms.length > 0 && !form.watch("room_id"))
          }
        >
          {isPending ? "Creazione..." : "Crea Prenotazione"}
        </Button>
      </div>
    </form>
  )
}
