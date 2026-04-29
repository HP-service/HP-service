export const dynamic = "force-dynamic"

import Link from "next/link"
import { Card, CardContent } from "@ui/card"
import { Badge } from "@ui/badge"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { UserCheck, Clock, Send, Home, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react"
import { getCheckInDashboard, getCheckInList } from "@db/queries/checkin"
import { sweepStaleCheckins } from "@db/queries/bookings"
import { getStatusLabel } from "@db/functions/booking-state"
import type { BookingStatus } from "@db/enums"

const STATUS_TABS = [
  { value: "tutti", label: "Tutti" },
  { value: "da_fare", label: "Da fare" },
  { value: "completato", label: "Completati" },
]

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; status?: string; q?: string }>
}) {
  const { date, status, q } = await searchParams
  const today = new Date().toISOString().slice(0, 10)
  const selectedDate = date || today

  // Auto-chiude le prenotazioni scadute prima di contare "In casa"
  await sweepStaleCheckins()

  const [dashResult, listResult] = await Promise.all([
    getCheckInDashboard(),
    getCheckInList({
      date: selectedDate,
      status: (status as "da_fare" | "completato" | "tutti") || "tutti",
      search: q,
    }),
  ])

  const kpi = dashResult.data
  const bookings = listResult.data ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Check-in</h1>
        <p className="text-muted-foreground">
          Gestisci gli arrivi e le trasmissioni Alloggiati Web
        </p>
      </div>

      {/* KPI Cards */}
      {kpi && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
                <Clock className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.daFare}</p>
                <p className="text-xs text-muted-foreground">Da fare oggi</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                <CheckCircle2 className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.completati}</p>
                <p className="text-xs text-muted-foreground">Completati oggi</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100">
                <Send className="h-5 w-5 text-indigo-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.alloggiatiPendenti}</p>
                <p className="text-xs text-muted-foreground">Alloggiati pendenti</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                <Home className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-bold">{kpi.inCasa}</p>
                <p className="text-xs text-muted-foreground">In casa</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <form className="flex items-center gap-2">
          <Input
            type="date"
            name="date"
            defaultValue={selectedDate}
            className="w-auto"
          />
          {q && <input type="hidden" name="q" value={q} />}
          {status && <input type="hidden" name="status" value={status} />}
          <Button type="submit" variant="outline" size="sm">
            Vai
          </Button>
        </form>

        <div className="flex items-center gap-2">
          {STATUS_TABS.map((tab) => {
            const params = new URLSearchParams()
            if (selectedDate !== today) params.set("date", selectedDate)
            if (tab.value !== "tutti") params.set("status", tab.value)
            if (q) params.set("q", q)
            const isActive = (status || "tutti") === tab.value

            return (
              <Link key={tab.value} href={`/check-in?${params.toString()}`}>
                <span
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-foreground text-background border-foreground"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {tab.label}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Table */}
      {listResult.error ? (
        <p className="text-sm text-destructive">{listResult.error}</p>
      ) : (
        <div className="rounded-lg border">
          {bookings.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nessun arrivo per questa data.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium">N°</th>
                  <th className="px-4 py-3 text-left font-medium">Ospite</th>
                  <th className="px-4 py-3 text-left font-medium">Camera</th>
                  <th className="px-4 py-3 text-center font-medium">Notti</th>
                  <th className="px-4 py-3 text-center font-medium">Stato</th>
                  <th className="px-4 py-3 text-center font-medium">Alloggiati</th>
                  <th className="px-4 py-3 text-right font-medium">Azione</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const guest = b.guest as { id: string; full_name: string } | null
                  const room = b.room as { name: string } | null
                  const roomType = b.room_type as { short_code: string | null; name: string } | null
                  const alloggiati = (b as Record<string, unknown>).alloggiati as {
                    esito: boolean
                    method: string
                  } | null
                  const isConfirmed = b.status === "Confirmed"

                  return (
                    <tr key={b.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <Link
                          href={`/bookings/${b.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {b.booking_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {guest ? (
                          <Link href={`/guests/${guest.id}`} className="hover:underline">
                            {guest.full_name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div>{room?.name || "—"}</div>
                        {roomType && (
                          <div className="text-xs text-muted-foreground">
                            {roomType.short_code || roomType.name}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">{b.nights}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          variant={isConfirmed ? "outline" : "default"}
                          className={
                            isConfirmed
                              ? "border-amber-200 bg-amber-50 text-amber-800"
                              : "bg-green-600"
                          }
                        >
                          {isConfirmed ? "Da fare" : "Fatto"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {alloggiati ? (
                          alloggiati.esito ? (
                            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Inviato
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                              <AlertCircle className="mr-1 h-3 w-3" /> Errore
                            </Badge>
                          )
                        ) : b.status === "CheckedIn" ? (
                          <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
                            Pendente
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {isConfirmed ? (
                          <Button asChild size="sm">
                            <Link href={`/bookings/${b.id}/check-in`}>
                              <UserCheck className="mr-1 h-3.5 w-3.5" /> Check-in
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild variant="ghost" size="sm">
                            <Link href={`/bookings/${b.id}`}>
                              Dettaglio <ChevronRight className="ml-1 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
