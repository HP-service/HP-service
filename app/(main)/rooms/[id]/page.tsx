export const dynamic = "force-dynamic"

import Link from "next/link"
import { notFound } from "next/navigation"
import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import { getRoom, getExpenseCategories } from "@db/queries/settings"
import { getExpenses } from "@db/queries/finance"
import { createClient } from "@/lib/supabase/server"
import { ArrowLeft, BedDouble, Wrench } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Badge } from "@ui/badge"
import { RoomDetailClient } from "./_components/room-detail-client"

async function getActiveBookingForRoom(roomId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from("bookings")
    .select(`
      id, booking_number, status, check_in, check_out,
      guest:guest_id (full_name)
    `)
    .eq("room_id", roomId)
    .in("status", ["CheckedIn", "Confirmed"])
    .order("check_in", { ascending: true })
    .limit(3)
  return data ?? []
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  Available:   { label: "Disponibile",    className: "bg-emerald-100 text-emerald-800" },
  Occupied:    { label: "Occupata",       className: "bg-blue-100 text-blue-800" },
  Maintenance: { label: "Manutenzione",   className: "bg-amber-100 text-amber-800" },
  OutOfOrder:  { label: "Fuori servizio", className: "bg-red-100 text-red-800" },
}

const CLEANING_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  Clean:      { label: "Pulita",    variant: "default" },
  Dirty:      { label: "Sporca",    variant: "destructive" },
  Inspection: { label: "Ispezione", variant: "outline" },
  InProgress: { label: "In corso",  variant: "secondary" },
}

export default async function RoomDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const profile = await requireRole(MAIN_APP_ROLES)
  const { id } = await params

  const [roomResult, expensesResult, categoriesResult, activeBookings] = await Promise.all([
    getRoom(id),
    getExpenses({ room_id: id }),
    getExpenseCategories(),
    getActiveBookingForRoom(id),
  ])

  if (roomResult.error || !roomResult.data) notFound()

  const room = roomResult.data
  const expenses = expensesResult.data ?? []
  const categories = categoriesResult.data ?? []

  const statusCfg = STATUS_CONFIG[room.status] ?? { label: room.status, className: "bg-muted text-foreground" }
  const cleanCfg = CLEANING_CONFIG[room.cleaning_status] ?? { label: room.cleaning_status, variant: "outline" as const }

  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/rooms"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Camere
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BedDouble className="h-5 w-5 text-muted-foreground" />
          Camera {room.name}
        </h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: room info */}
        <div className="space-y-4">
          {/* Info generale */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Informazioni</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Piano</span>
                <span className="font-medium">{room.floor != null ? (room.floor === 0 ? "Terra" : room.floor) : "—"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Stato</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusCfg.className}`}>
                  {statusCfg.label}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Pulizia</span>
                <Badge variant={cleanCfg.variant} className="text-xs">{cleanCfg.label}</Badge>
              </div>
              {room.room_type_assignments && room.room_type_assignments.length > 0 && (
                <div className="pt-1">
                  <p className="text-muted-foreground mb-1.5">Tipologie</p>
                  <div className="flex flex-wrap gap-1">
                    {(room.room_type_assignments as Array<{
                      id: string; priority: number; is_active: boolean;
                      room_types: { id: string; name: string; short_code: string | null; base_price: number | null } | null
                    }>)
                      .sort((a, b) => a.priority - b.priority)
                      .map((a) => (
                        <span
                          key={a.id}
                          className={`inline-flex items-center rounded px-2 py-0.5 text-xs ${
                            a.is_active ? "bg-primary/10 text-primary font-medium" : "bg-muted text-muted-foreground line-through"
                          }`}
                        >
                          {a.room_types?.name ?? "?"}
                          {a.room_types?.base_price != null && (
                            <span className="ml-1 opacity-60">€{a.room_types.base_price}</span>
                          )}
                        </span>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prenotazioni attive */}
          {activeBookings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prenotazioni attive</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {activeBookings.map((b) => {
                  const booking = b as unknown as {
                    id: string; booking_number: string; status: string;
                    check_in: string; check_out: string;
                    guest: { full_name: string } | null
                  }
                  return (
                    <Link key={booking.id} href={`/bookings/${booking.id}`} className="block hover:bg-muted/50 rounded p-2 -mx-2 transition-colors">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{booking.guest?.full_name ?? booking.booking_number}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          booking.status === "CheckedIn" ? "bg-blue-100 text-blue-800" : "bg-emerald-100 text-emerald-800"
                        }`}>
                          {booking.status === "CheckedIn" ? "In casa" : "Confermata"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(booking.check_in).toLocaleDateString("it-IT")} →{" "}
                        {new Date(booking.check_out).toLocaleDateString("it-IT")}
                      </p>
                    </Link>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {/* Spese totali */}
          <Card>
            <CardContent className="pt-5">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100 p-2">
                  <Wrench className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Spese camera</p>
                  <p className="text-2xl font-bold">€{Math.round(totalExpenses).toLocaleString("it-IT")}</p>
                  <p className="text-xs text-muted-foreground">{expenses.length} voci registrate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: notes + expenses */}
        <div className="lg:col-span-2">
          <RoomDetailClient
            room={{
              id: room.id,
              name: room.name,
              notes: room.notes,
            }}
            expenses={expenses as Array<{
              id: string; description: string; amount: number; date: string;
              vendor: string | null; status: string; notes: string | null;
              category: { id: string; name: string; color: string | null } | null
            }>}
            categories={categories}
            propertyId={profile.property_id!}
          />
        </div>
      </div>
    </div>
  )
}
