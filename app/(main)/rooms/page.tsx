export const dynamic = "force-dynamic"

import { getRooms } from "@db/queries/settings"
import { createClient } from "@/lib/supabase/server"
import { sweepStaleCheckins } from "@db/queries/bookings"
import { RoomsGrid } from "./_components/rooms-grid"

async function getInHouseByRoom() {
  const supabase = await createClient()
  const { data } = await supabase
    .from("bookings")
    .select("room_id, guest:guest_id (full_name), check_out")
    .eq("status", "CheckedIn")
    .not("room_id", "is", null)
  return data ?? []
}

export default async function RoomsPage() {
  // Auto-chiude le prenotazioni scadute prima di leggere chi è "in casa"
  await sweepStaleCheckins()

  const [roomsResult, inHouse] = await Promise.all([
    getRooms(),
    getInHouseByRoom(),
  ])

  const inHouseMap = Object.fromEntries(
    inHouse.map((b) => [b.room_id, b])
  )

  const rooms = (roomsResult.data ?? []) as Parameters<typeof RoomsGrid>[0]["rooms"]

  // Summary counts
  const total = rooms.length
  const occupied = rooms.filter((r) => inHouseMap[r.id]).length
  const available = rooms.filter(
    (r) => !inHouseMap[r.id] && r.status === "Available"
  ).length
  const cleaning = rooms.filter(
    (r) => r.cleaning_status === "InProgress" || r.cleaning_status === "Dirty"
  ).length
  const maintenance = rooms.filter(
    (r) => r.status === "Maintenance" || r.status === "OutOfOrder"
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Camere</h1>
          <p className="text-sm text-slate-500 mt-1">
            {total} camere · {occupied} occupate · {available} libere
          </p>
        </div>
      </div>

      {/* Summary pills */}
      {!roomsResult.error && rooms.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm">
            <span className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="font-semibold text-slate-700">{total}</span>
            <span className="text-slate-500">Totale</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 border border-indigo-200 rounded-xl text-sm">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="font-semibold text-indigo-700">{occupied}</span>
            <span className="text-indigo-600">Occupate</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="font-semibold text-emerald-700">{available}</span>
            <span className="text-emerald-600">Disponibili</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-sm">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="font-semibold text-amber-700">{cleaning}</span>
            <span className="text-amber-600">In pulizia</span>
          </div>
          {maintenance > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-sm">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="font-semibold text-red-700">{maintenance}</span>
              <span className="text-red-600">Manutenzione</span>
            </div>
          )}
        </div>
      )}

      {roomsResult.error ? (
        <div className="rounded-xl border bg-card p-6">
          <p className="text-sm text-destructive">{roomsResult.error}</p>
        </div>
      ) : (
        <RoomsGrid rooms={rooms} inHouseMap={inHouseMap} />
      )}
    </div>
  )
}
