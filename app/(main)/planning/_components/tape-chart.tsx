"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { Button } from "@ui/button"

type RoomTypeAssignment = {
  room_type_id: string
  room_types: { id: string; name: string; short_code: string | null } | null
}

type Room = {
  id: string
  name: string
  floor: number | null
  room_type_assignments: RoomTypeAssignment[]
}

type Booking = {
  id: string
  room_id: string | null
  room_type_id: string
  check_in: string
  check_out: string
  status: string
  booking_number: string
  guest: { full_name: string } | null
  channel: { name: string } | null
}

type Props = {
  rooms: Room[]
  bookings: Booking[]
  startDate: string
}

const CELL_WIDTH = 56
const ROW_HEIGHT = 64
const HEADER_WIDTH = 148

// Channel-based gradient colors (matching channelConfig from Figma)
const CHANNEL_STYLES: Record<string, { gradient: string; textColor: string; shortLabel: string }> = {
  airbnb:   { gradient: "linear-gradient(135deg, #FF385C, #E31C5F)", textColor: "white", shortLabel: "A" },
  booking:  { gradient: "linear-gradient(135deg, #003580, #00224F)", textColor: "white", shortLabel: "B." },
  expedia:  { gradient: "linear-gradient(135deg, #FBCE00, #E5B800)", textColor: "#1a1a2e", shortLabel: "E" },
  direct:   { gradient: "linear-gradient(135deg, #10b981, #059669)", textColor: "white", shortLabel: "D" },
  default:  { gradient: "linear-gradient(135deg, #6366f1, #4f46e5)", textColor: "white", shortLabel: "?" },
}

function getChannelStyle(channelName: string | null | undefined) {
  const name = (channelName ?? "").toLowerCase()
  if (name.includes("airbnb")) return CHANNEL_STYLES.airbnb
  if (name.includes("booking")) return CHANNEL_STYLES.booking
  if (name.includes("expedia")) return CHANNEL_STYLES.expedia
  if (name.includes("dirett") || name.includes("direct")) return CHANNEL_STYLES.direct
  return CHANNEL_STYLES.default
}

function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d + days))
  return utc.toISOString().split("T")[0]
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number)
  const [ty, tm, td] = to.split("-").map(Number)
  return (Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86400000
}

function formatMonthYear(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00")
  return d.toLocaleDateString("it-IT", { month: "long", year: "numeric" })
}

const NUM_DAYS = 21
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"]

export function TapeChart({ rooms, bookings, startDate }: Props) {
  const router = useRouter()
  const today = new Date().toISOString().split("T")[0]

  const days = Array.from({ length: NUM_DAYS }, (_, i) => addDays(startDate, i))

  // Group rooms by room type
  const roomTypeMap = new Map<string, { name: string; rooms: Room[] }>()
  for (const room of rooms) {
    const primaryAssignment = room.room_type_assignments[0]
    if (!primaryAssignment?.room_types) continue
    const typeId = primaryAssignment.room_type_id
    const typeName = primaryAssignment.room_types.short_code ?? primaryAssignment.room_types.name
    if (!roomTypeMap.has(typeId)) {
      roomTypeMap.set(typeId, { name: typeName, rooms: [] })
    }
    roomTypeMap.get(typeId)!.rooms.push(room)
  }

  const unassignedRooms = rooms.filter((r) => r.room_type_assignments.length === 0)

  const bookingsByRoom = new Map<string, Booking[]>()
  for (const booking of bookings) {
    if (!booking.room_id) continue
    if (!bookingsByRoom.has(booking.room_id)) bookingsByRoom.set(booking.room_id, [])
    bookingsByRoom.get(booking.room_id)!.push(booking)
  }

  const prevStart = addDays(startDate, -14)
  const nextStart = addDays(startDate, 14)
  const totalWidth = HEADER_WIDTH + NUM_DAYS * CELL_WIDTH

  function getBookingBar(booking: Booking) {
    const offsetDays = Math.max(0, daysBetween(startDate, booking.check_in))
    const endDay = Math.min(NUM_DAYS, daysBetween(startDate, booking.check_out))
    const startDay = Math.max(0, offsetDays)
    const durationDays = endDay - startDay
    const left = startDay * CELL_WIDTH + 3
    const width = durationDays * CELL_WIDTH - 6
    const nights = daysBetween(booking.check_in, booking.check_out)
    return { left, width, nights }
  }

  function isWeekend(dateStr: string): boolean {
    const d = new Date(dateStr + "T12:00:00")
    return d.getDay() === 0 || d.getDay() === 6
  }

  function getDayLabel(dateStr: string): string {
    const d = new Date(dateStr + "T12:00:00")
    return DAY_LABELS[d.getDay()]
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold capitalize">{formatMonthYear(startDate)}</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-border/60"
            onClick={() => router.push(`/planning?start=${prevStart}`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-border/60 font-semibold"
            onClick={() => router.push(`/planning?start=${today}`)}
          >
            <Calendar className="mr-1.5 h-4 w-4" />
            Oggi
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="rounded-xl border-border/60"
            onClick={() => router.push(`/planning?start=${nextStart}`)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <div style={{ minWidth: totalWidth }}>

            {/* Header row */}
            <div className="flex border-b border-border bg-muted/30 sticky top-0 z-10" style={{ height: 52 }}>
              {/* Camera label */}
              <div
                className="shrink-0 flex items-center px-4 border-r border-border"
                style={{ width: HEADER_WIDTH }}
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Camera</span>
              </div>
              {/* Day columns */}
              {days.map((day) => {
                const isToday = day === today
                const weekend = isWeekend(day)
                const dayNum = new Date(day + "T12:00:00").getDate()
                const weekday = getDayLabel(day)
                return (
                  <div
                    key={day}
                    className={`shrink-0 flex flex-col items-center justify-center border-r border-border/50 ${
                      isToday ? "bg-blue-50" : weekend ? "bg-slate-50/50" : ""
                    }`}
                    style={{ width: CELL_WIDTH }}
                  >
                    <span className={`text-xs font-medium leading-tight ${isToday ? "text-blue-600" : weekend ? "text-slate-400" : "text-muted-foreground"}`}>
                      {weekday}
                    </span>
                    <span className={`text-base font-bold leading-tight ${isToday ? "text-blue-600" : weekend ? "text-slate-400" : "text-foreground"}`}>
                      {dayNum}
                    </span>
                    {isToday && <div className="w-1 h-1 rounded-full bg-blue-500 mt-0.5" />}
                  </div>
                )
              })}
            </div>

            {/* Room groups by type */}
            {Array.from(roomTypeMap.entries()).map(([typeId, group]) => (
              <div key={typeId}>
                {/* Type separator */}
                <div className="flex items-center border-b border-border bg-muted/20" style={{ height: 28 }}>
                  <div className="shrink-0 px-4 flex items-center" style={{ width: HEADER_WIDTH }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      {group.name}
                    </span>
                  </div>
                  <div className="flex-1 flex items-center px-2">
                    <div className="h-px flex-1 border-t border-dashed border-border/50" />
                  </div>
                </div>

                {/* Room rows */}
                {group.rooms.map((room, ri) => {
                  const roomBookings = bookingsByRoom.get(room.id) ?? []
                  const isLastInGroup = ri === group.rooms.length - 1
                  return (
                    <div
                      key={room.id}
                      className={`flex relative ${isLastInGroup ? "" : "border-b border-border/30"} hover:bg-muted/10 transition-colors`}
                      style={{ height: ROW_HEIGHT }}
                    >
                      {/* Room label */}
                      <div
                        className="shrink-0 flex items-center gap-2.5 px-4 border-r border-border"
                        style={{ width: HEADER_WIDTH }}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 text-sm font-bold text-slate-600 flex-shrink-0">
                          {room.name}
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-foreground leading-tight">{group.name}</div>
                        </div>
                      </div>

                      {/* Day cells + booking bars */}
                      <div className="relative flex-1">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex">
                          {days.map((day) => (
                            <div
                              key={day}
                              className={`shrink-0 h-full border-r border-border/20 ${
                                day === today ? "bg-blue-50/60" : isWeekend(day) ? "bg-slate-50/30" : ""
                              }`}
                              style={{ width: CELL_WIDTH }}
                            />
                          ))}
                        </div>

                        {/* Booking bars */}
                        {roomBookings.map((booking) => {
                          const { left, width, nights } = getBookingBar(booking)
                          if (width <= 0) return null
                          const channelName = (booking.channel as { name: string } | null)?.name
                          const ch = getChannelStyle(channelName)
                          const isCheckout = booking.status === "CheckedOut"
                          const guestFirst = booking.guest?.full_name?.split(" ")[0] ?? ""
                          const guestLastInitial = booking.guest?.full_name?.split(" ")[1]?.[0]

                          return (
                            <Link
                              key={booking.id}
                              href={`/bookings/${booking.id}`}
                              className={`absolute flex items-center cursor-pointer group/bar ${isCheckout ? "opacity-40" : ""}`}
                              style={{ left, top: 12, width, height: 40, zIndex: 2 }}
                              title={`#${booking.booking_number} ${booking.guest?.full_name ?? ""} (${channelName ?? "Diretto"})`}
                            >
                              <div
                                className="w-full h-full rounded-full flex items-center overflow-hidden transition-all duration-150 group-hover/bar:shadow-lg group-hover/bar:-translate-y-0.5"
                                style={{ background: ch.gradient }}
                              >
                                {/* Channel badge */}
                                <div className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm mx-1.5">
                                  <span className="text-[10px] font-bold" style={{ color: ch.textColor }}>
                                    {ch.shortLabel}
                                  </span>
                                </div>
                                {/* Guest name */}
                                {width > 72 && (
                                  <span
                                    className="text-xs font-medium truncate flex-1 pr-2"
                                    style={{ color: ch.textColor, opacity: 0.95 }}
                                  >
                                    {guestFirst}
                                    {width > 110 && guestLastInitial ? ` ${guestLastInitial}.` : ""}
                                  </span>
                                )}
                                {/* Nights count */}
                                {width > 150 && (
                                  <span
                                    className="text-[11px] font-bold pr-3 flex-shrink-0"
                                    style={{ color: ch.textColor, opacity: 0.7 }}
                                  >
                                    {nights}n
                                  </span>
                                )}
                              </div>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            {/* Unassigned rooms */}
            {unassignedRooms.length > 0 && (
              <div>
                <div className="flex items-center border-b border-border bg-muted/20" style={{ height: 28 }}>
                  <div className="shrink-0 px-4" style={{ width: HEADER_WIDTH }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">N/A</span>
                  </div>
                  <div className="flex-1 flex items-center px-2">
                    <div className="h-px flex-1 border-t border-dashed border-border/30" />
                  </div>
                </div>
                {unassignedRooms.map((room) => (
                  <div
                    key={room.id}
                    className="flex border-b border-border/20 last:border-b-0"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className="shrink-0 flex items-center gap-2.5 px-4 border-r border-border" style={{ width: HEADER_WIDTH }}>
                      <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                        {room.name}
                      </div>
                    </div>
                    <div className="flex flex-1">
                      {days.map((day) => (
                        <div key={day} className="shrink-0 border-r border-border/10 h-full" style={{ width: CELL_WIDTH }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rooms.length === 0 && (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nessuna camera configurata.
              </div>
            )}

          </div>
        </div>

        {/* Legend */}
        <div className="border-t border-border px-5 py-3 bg-muted/20 flex flex-wrap gap-4">
          {Object.entries({
            Airbnb: CHANNEL_STYLES.airbnb,
            "Booking.com": CHANNEL_STYLES.booking,
            Expedia: CHANNEL_STYLES.expedia,
            Diretto: CHANNEL_STYLES.direct,
            Altro: CHANNEL_STYLES.default,
          }).map(([label, ch]) => (
            <div key={label} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: ch.gradient }} />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
          <div className="w-px h-4 bg-border/60" />
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-muted flex-shrink-0 opacity-40" />
            <span className="text-xs text-muted-foreground">Check-out</span>
          </div>
        </div>
      </div>
    </div>
  )
}
