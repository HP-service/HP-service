export const dynamic = "force-dynamic"

import Link from "next/link"
import { getBookings } from "@db/queries/bookings"
import { Button } from "@ui/button"
import { Plus, Search, BookOpen } from "lucide-react"
import { getStatusLabel } from "@db/functions/booking-state"
import type { BookingStatus } from "@db/enums"
import { BookingsExport } from "./_components/bookings-export"

const STATUS_TABS = [
  { value: "", label: "Tutte" },
  { value: "CheckedIn", label: "In struttura" },
  { value: "Confirmed", label: "Confermate" },
  { value: "Inquiry", label: "Richieste" },
  { value: "CheckedOut", label: "Partite" },
  { value: "Cancelled", label: "Cancellate" },
]

const STATUS_CONFIG: Record<string, {
  label: string
  dot: string
  bg: string
  color: string
}> = {
  Inquiry:    { label: "Richiesta",     dot: "bg-indigo-400", bg: "bg-indigo-100", color: "text-indigo-700" },
  Confirmed:  { label: "Confermata",    dot: "bg-indigo-500", bg: "bg-indigo-100", color: "text-indigo-700" },
  CheckedIn:  { label: "In struttura",  dot: "bg-emerald-500", bg: "bg-emerald-100", color: "text-emerald-700" },
  CheckedOut: { label: "Partita",       dot: "bg-slate-400", bg: "bg-slate-100", color: "text-slate-600" },
  Cancelled:  { label: "Cancellata",    dot: "bg-red-500", bg: "bg-red-100", color: "text-red-700" },
  NoShow:     { label: "No Show",       dot: "bg-amber-500", bg: "bg-amber-100", color: "text-amber-700" },
}

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

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>
}) {
  const { status, q } = await searchParams
  const result = await getBookings({
    status: status as BookingStatus | undefined,
    search: q,
  })

  const bookings = result.data ?? []

  // Prepara dati per export
  const exportData = bookings.map((b) => {
    const gR = b.guest
    const guest = Array.isArray(gR) ? (gR[0] ?? null) : (gR as { id: string; full_name: string } | null)
    const rtR = b.room_type
    const roomType = Array.isArray(rtR) ? (rtR[0] ?? null) : (rtR as { name: string; short_code: string | null } | null)
    const rR = b.room
    const room = Array.isArray(rR) ? (rR[0] ?? null) : (rR as { name: string } | null)
    const chR = b.channel
    const channel = Array.isArray(chR) ? (chR[0] ?? null) : (chR as { name: string } | null)
    return {
      booking_number: b.booking_number,
      guest_name: guest?.full_name ?? "—",
      room_type: roomType?.name ?? "—",
      room_name: room?.name ?? "—",
      check_in: b.check_in,
      check_out: b.check_out,
      nights: b.nights,
      total_amount: Number(b.total_amount ?? 0).toFixed(2),
      status: getStatusLabel(b.status as BookingStatus),
      channel: channel?.name ?? "Diretto",
    }
  })

  const today = new Date().toISOString().split("T")[0]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Prenotazioni</h1>
          <p className="text-sm text-slate-500 mt-0.5">{bookings.length} prenotazioni totali</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <BookingsExport data={exportData} />
          <Button asChild className="rounded-xl shadow-sm shadow-primary/30">
            <Link href="/bookings/new">
              <Plus className="mr-1 h-4 w-4" />
              Nuova prenotazione
            </Link>
          </Button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex flex-col gap-3">
        {/* Segmented control tabs */}
        <div className="flex items-center gap-1 flex-wrap bg-muted/50 p-1 rounded-xl w-fit">
          {STATUS_TABS.map((tab) => {
            const params = new URLSearchParams()
            if (tab.value) params.set("status", tab.value)
            if (q) params.set("q", q)
            const isActive = (status ?? "") === tab.value

            return (
              <Link key={tab.value} href={`/bookings?${params.toString()}`}>
                <span
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    isActive
                      ? "bg-white text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>

        {/* Search */}
        <form className="flex gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Cerca ospite, numero prenotazione..."
              className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
            />
          </div>
          {status && <input type="hidden" name="status" value={status} />}
          <button
            type="submit"
            className="flex items-center gap-1.5 px-3 py-2 border border-border bg-card rounded-xl text-sm text-muted-foreground hover:bg-muted transition-colors font-medium"
          >
            <Search className="h-4 w-4" />
            Cerca
          </button>
        </form>
      </div>

      {/* Table */}
      {result.error ? (
        <p className="text-sm text-destructive">{result.error}</p>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          {bookings.length === 0 ? (
            <div className="text-center py-14">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <BookOpen className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-muted-foreground text-sm font-medium">Nessuna prenotazione trovata</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="py-3 pl-4 pr-0 w-5" />
                    <th className="text-left py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Prenotazione</th>
                    <th className="text-left py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Ospite</th>
                    <th className="text-left py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Camera</th>
                    <th className="text-left py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Canale</th>
                    <th className="text-left py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Check-in</th>
                    <th className="text-left py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Check-out</th>
                    <th className="text-center py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Notti</th>
                    <th className="text-center py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Stato</th>
                    <th className="text-right py-3 px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Importo</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => {
                    // Supabase PostgREST può restituire array o oggetto singolo per i join
                    const guestRaw = b.guest
                    const guest: { id: string; full_name: string } | null =
                      Array.isArray(guestRaw) ? (guestRaw[0] ?? null) : (guestRaw as { id: string; full_name: string } | null)
                    const roomTypeRaw = b.room_type
                    const roomType: { name: string; short_code: string | null } | null =
                      Array.isArray(roomTypeRaw) ? (roomTypeRaw[0] ?? null) : (roomTypeRaw as { name: string; short_code: string | null } | null)
                    const roomRaw = b.room
                    const room: { name: string } | null =
                      Array.isArray(roomRaw) ? (roomRaw[0] ?? null) : (roomRaw as { name: string } | null)
                    const channelRaw = b.channel
                    const channel: { name: string } | null =
                      Array.isArray(channelRaw) ? (channelRaw[0] ?? null) : (channelRaw as { name: string } | null)
                    const sc = STATUS_CONFIG[b.status] ?? STATUS_CONFIG.Confirmed
                    const ch = getChannelStyle(channel?.name)
                    const isToday = b.check_in === today
                    const isDeparting = b.check_out === today
                    const initials = (guest?.full_name ?? "??").split(" ").map((n) => n[0]).join("").slice(0, 2)

                    return (
                      <tr
                        key={b.id}
                        className={`border-b border-border/40 hover:bg-muted/20 transition-colors ${
                          isToday ? "bg-amber-50/30" : isDeparting ? "bg-purple-50/20" : ""
                        }`}
                      >
                        {/* Status dot */}
                        <td className="py-3 pl-4 pr-0 w-5">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${sc.dot}`} />
                        </td>

                        {/* Booking number */}
                        <td className="py-3 px-3">
                          <Link href={`/bookings/${b.id}`} className="hover:underline">
                            <span className="text-xs font-mono text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                              {b.booking_number}
                            </span>
                          </Link>
                        </td>

                        {/* Guest */}
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold shadow-sm"
                              style={{ background: ch.gradient, color: ch.textColor }}
                            >
                              {initials}
                            </div>
                            <div className="min-w-0">
                              {guest?.id ? (
                                <Link href={`/guests/${guest.id}`} className="hover:underline">
                                  <p className="text-sm font-semibold text-foreground truncate">{guest.full_name}</p>
                                </Link>
                              ) : guest?.full_name ? (
                                <p className="text-sm font-semibold text-foreground truncate">{guest.full_name}</p>
                              ) : (
                                <p className="text-sm text-muted-foreground">—</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Room */}
                        <td className="py-3 px-3">
                          {room ? (
                            <div className="flex items-center gap-2">
                              <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 text-xs font-bold text-slate-700">
                                {room.name}
                              </div>
                              {roomType && (
                                <span className="text-[11px] text-muted-foreground font-medium hidden xl:inline">
                                  {roomType.short_code ?? roomType.name}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {roomType?.short_code ?? roomType?.name ?? "—"}
                            </span>
                          )}
                        </td>

                        {/* Channel */}
                        <td className="py-3 px-3 hidden lg:table-cell">
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold flex-shrink-0 shadow-sm"
                              style={{ background: ch.gradient, color: ch.textColor }}
                            >
                              {ch.shortLabel}
                            </span>
                            <span className="text-xs text-muted-foreground font-medium hidden xl:block">
                              {channel?.name ?? "Diretto"}
                            </span>
                          </div>
                        </td>

                        {/* Check-in */}
                        <td className="py-3 px-3 hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            {isToday && <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />}
                            <span className="text-sm text-foreground font-medium">
                              {b.check_in ? new Date(b.check_in).toLocaleDateString("it-IT", { day: "numeric", month: "short" }) : "—"}
                            </span>
                          </div>
                        </td>

                        {/* Check-out */}
                        <td className="py-3 px-3 hidden md:table-cell">
                          <div className="flex items-center gap-1.5">
                            {isDeparting && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0" />}
                            <span className="text-sm text-foreground font-medium">
                              {b.check_out ? new Date(b.check_out).toLocaleDateString("it-IT", { day: "numeric", month: "short" }) : "—"}
                            </span>
                          </div>
                        </td>

                        {/* Nights */}
                        <td className="py-3 px-3 text-center hidden lg:table-cell">
                          <span className="text-sm text-muted-foreground font-medium">{b.nights}n</span>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${sc.bg} ${sc.color}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </td>

                        {/* Amount */}
                        <td className="py-3 px-3 text-right">
                          <p className="text-sm font-bold text-foreground">€ {Number(b.total_amount ?? 0).toLocaleString("it-IT", { minimumFractionDigits: 0 })}</p>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
