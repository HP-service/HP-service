export const dynamic = "force-dynamic"

import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import { createClient } from "@/lib/supabase/server"
import { PrintFrame } from "../_components/print-frame"

export default async function StampaPuliziePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const profile = await requireRole(MAIN_APP_ROLES)
  const { date } = await searchParams
  const today = date ?? new Date().toISOString().slice(0, 10)
  const supabase = await createClient()
  const pid = profile.property_id ?? ""

  const { data: property } = await supabase
    .from("properties")
    .select("name")
    .eq("id", pid)
    .single()

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, floor, status, cleaning_status, notes")
    .eq("property_id", pid)
    .order("floor")
    .order("name")

  // Per ogni camera: chi parte oggi (priorità alta), chi è ancora dentro (stayover)
  const { data: partenze } = await supabase
    .from("bookings")
    .select("room_id, guests:guest_id(full_name)")
    .eq("property_id", pid)
    .eq("check_out", today)
    .in("status", ["CheckedIn", "CheckedOut"])

  const partenzeByRoom = new Map<string, string>()
  for (const p of partenze ?? []) {
    if (p.room_id) {
      const g = p.guests as unknown as { full_name: string } | null
      partenzeByRoom.set(p.room_id, g?.full_name ?? "Ospite")
    }
  }

  type Row = {
    id: string
    name: string
    floor: number | null
    cleaning: string
    type: "Checkout" | "Stayover" | "Manutenzione" | "Routine"
    note: string
    priority: number
  }
  const rows: Row[] = []
  for (const r of rooms ?? []) {
    const guestExit = partenzeByRoom.get(r.id)
    const isMaint = r.status === "Maintenance" || r.status === "OutOfOrder"
    let type: Row["type"] = "Routine"
    let priority = 4
    if (isMaint) {
      type = "Manutenzione"
      priority = 3
    } else if (guestExit) {
      type = "Checkout"
      priority = 1
    } else if (r.cleaning_status === "Dirty") {
      type = "Stayover"
      priority = 2
    } else if (r.cleaning_status === "InProgress") {
      priority = 2
    } else {
      // Routine - skip se già pulita
      if (r.cleaning_status === "Clean") continue
    }
    rows.push({
      id: r.id,
      name: r.name,
      floor: r.floor,
      cleaning: r.cleaning_status,
      type,
      note: guestExit ? `Checkout: ${guestExit}` : (r.notes ?? "—"),
      priority,
    })
  }
  rows.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))

  const dateLabel = new Date(today).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <PrintFrame
      title="Foglio pulizie"
      subtitle={dateLabel}
      property={property?.name ?? "Struttura"}
    >
      {rows.length === 0 ? (
        <p className="py-12 text-center text-sm italic text-slate-500">
          Nessuna camera da pulire oggi 🎉
        </p>
      ) : (
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="w-10 border-b-2 border-slate-900 bg-slate-100 px-2 py-2 text-left font-bold uppercase tracking-wider text-slate-700">
                ✓
              </th>
              <th className="border-b-2 border-slate-900 bg-slate-100 px-2 py-2 text-left font-bold uppercase tracking-wider text-slate-700">
                Camera
              </th>
              <th className="border-b-2 border-slate-900 bg-slate-100 px-2 py-2 text-left font-bold uppercase tracking-wider text-slate-700">
                Piano
              </th>
              <th className="border-b-2 border-slate-900 bg-slate-100 px-2 py-2 text-left font-bold uppercase tracking-wider text-slate-700">
                Tipo
              </th>
              <th className="border-b-2 border-slate-900 bg-slate-100 px-2 py-2 text-left font-bold uppercase tracking-wider text-slate-700">
                Note
              </th>
              <th className="w-32 border-b-2 border-slate-900 bg-slate-100 px-2 py-2 text-left font-bold uppercase tracking-wider text-slate-700">
                Firma
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-200">
                <td className="px-2 py-3">
                  <span className="inline-block h-4 w-4 rounded border-2 border-slate-400" />
                </td>
                <td className="px-2 py-3 text-base font-bold text-slate-900">
                  {r.name}
                </td>
                <td className="px-2 py-3 text-slate-700">
                  {r.floor != null ? `P${r.floor}` : "—"}
                </td>
                <td className="px-2 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      r.type === "Checkout"
                        ? "bg-rose-100 text-rose-700"
                        : r.type === "Stayover"
                          ? "bg-amber-100 text-amber-700"
                          : r.type === "Manutenzione"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {r.type}
                  </span>
                </td>
                <td className="px-2 py-3 text-slate-600">{r.note}</td>
                <td className="border-l border-slate-200 px-2 py-3" />
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="mt-8 grid grid-cols-2 gap-12 border-t border-slate-200 pt-6 text-xs">
        <div>
          <div className="border-t border-slate-400 pt-1 text-slate-500">
            Firma Housekeeping
          </div>
        </div>
        <div>
          <div className="border-t border-slate-400 pt-1 text-slate-500">
            Verifica Manager
          </div>
        </div>
      </div>
    </PrintFrame>
  )
}
