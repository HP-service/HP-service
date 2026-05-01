export const dynamic = "force-dynamic"

import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import { createClient } from "@/lib/supabase/server"
import { PrintFrame } from "../_components/print-frame"

export default async function StampaInCasaPage() {
  const profile = await requireRole(MAIN_APP_ROLES)
  const supabase = await createClient()
  const pid = profile.property_id ?? ""

  const { data: property } = await supabase
    .from("properties")
    .select("name")
    .eq("id", pid)
    .single()

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      "id, booking_number, check_in, check_out, adults, children, guests:guest_id(full_name, phone, email, nationality), rooms:room_id(name)",
    )
    .eq("property_id", pid)
    .eq("status", "CheckedIn")
    .order("check_out")

  const today = new Date().toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <PrintFrame
      title="Ospiti in casa"
      subtitle={today}
      property={property?.name ?? "Struttura"}
    >
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            {[
              "Camera",
              "Ospite",
              "Pax",
              "Telefono",
              "Email",
              "Naz.",
              "Check-in",
              "Check-out",
            ].map((h) => (
              <th
                key={h}
                className="border-b-2 border-slate-900 bg-slate-100 px-2 py-1.5 text-left font-bold uppercase tracking-wider text-slate-700"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(bookings ?? []).length === 0 ? (
            <tr>
              <td colSpan={8} className="py-6 text-center text-slate-500">
                Nessun ospite in casa al momento.
              </td>
            </tr>
          ) : (
            bookings!.map((b) => {
              const g = b.guests as unknown as {
                full_name: string
                phone: string | null
                email: string | null
                nationality: string | null
              } | null
              const r = b.rooms as unknown as { name: string } | null
              return (
                <tr key={b.id} className="border-b border-slate-200">
                  <td className="px-2 py-1.5 font-bold text-slate-900">
                    {r?.name ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-slate-800">
                    {g?.full_name ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-slate-700">
                    {b.adults}A{b.children ? `+${b.children}B` : ""}
                  </td>
                  <td className="px-2 py-1.5 text-slate-700">{g?.phone ?? "—"}</td>
                  <td className="px-2 py-1.5 text-slate-700">{g?.email ?? "—"}</td>
                  <td className="px-2 py-1.5 text-slate-700">
                    {g?.nationality ?? "—"}
                  </td>
                  <td className="px-2 py-1.5 text-slate-700">
                    {new Date(b.check_in).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </td>
                  <td className="px-2 py-1.5 font-bold text-slate-900">
                    {new Date(b.check_out).toLocaleDateString("it-IT", {
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>

      <div className="mt-8 text-[10px] italic text-slate-500">
        Documento per uso interno. Non diffondere.
      </div>
    </PrintFrame>
  )
}
