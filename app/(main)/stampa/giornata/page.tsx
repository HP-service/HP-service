export const dynamic = "force-dynamic"

import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import { createClient } from "@/lib/supabase/server"
import { PrintFrame } from "../_components/print-frame"

export default async function StampaGiornataPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const profile = await requireRole(MAIN_APP_ROLES)
  const { date } = await searchParams
  const today = date ?? new Date().toISOString().slice(0, 10)

  const supabase = await createClient()
  const pid = profile.property_id ?? ""

  // Property info
  const { data: property } = await supabase
    .from("properties")
    .select("name, address, city")
    .eq("id", pid)
    .single()

  // Arrivi
  const { data: arrivi } = await supabase
    .from("bookings")
    .select(
      "id, booking_number, status, adults, children, special_requests, guests:guest_id(full_name, phone), rooms:room_id(name), channels:channel_id(name)",
    )
    .eq("property_id", pid)
    .eq("check_in", today)
    .in("status", ["Confirmed", "CheckedIn"])

  // Partenze
  const { data: partenze } = await supabase
    .from("bookings")
    .select(
      "id, booking_number, status, total_amount, guests:guest_id(full_name, phone), rooms:room_id(name)",
    )
    .eq("property_id", pid)
    .eq("check_out", today)
    .in("status", ["CheckedIn", "CheckedOut"])

  // In casa
  const { data: inCasa } = await supabase
    .from("bookings")
    .select(
      "id, booking_number, check_out, guests:guest_id(full_name, phone), rooms:room_id(name)",
    )
    .eq("property_id", pid)
    .eq("status", "CheckedIn")
    .order("check_out")

  const dateLabel = new Date(today).toLocaleDateString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })

  return (
    <PrintFrame
      title="Giornata operativa"
      subtitle={dateLabel}
      property={property?.name ?? "Struttura"}
    >
      <div className="space-y-6">
        <Section title={`Arrivi (${arrivi?.length ?? 0})`}>
          <Table
            headers={["#", "Ospite", "Camera", "Pax", "Canale", "Telefono", "Note"]}
            rows={
              arrivi?.map((b) => {
                const g = b.guests as { full_name: string; phone: string | null } | null
                const r = b.rooms as { name: string } | null
                const ch = b.channels as { name: string } | null
                return [
                  b.booking_number,
                  g?.full_name ?? "—",
                  r?.name ?? "—",
                  `${b.adults}A${b.children ? ` + ${b.children}B` : ""}`,
                  ch?.name ?? "—",
                  g?.phone ?? "—",
                  b.special_requests ?? "—",
                ]
              }) ?? []
            }
            empty="Nessun arrivo previsto oggi"
          />
        </Section>

        <Section title={`Partenze (${partenze?.length ?? 0})`}>
          <Table
            headers={["#", "Ospite", "Camera", "Telefono", "Saldo"]}
            rows={
              partenze?.map((b) => {
                const g = b.guests as { full_name: string; phone: string | null } | null
                const r = b.rooms as { name: string } | null
                return [
                  b.booking_number,
                  g?.full_name ?? "—",
                  r?.name ?? "—",
                  g?.phone ?? "—",
                  `€ ${Number(b.total_amount ?? 0).toFixed(2)}`,
                ]
              }) ?? []
            }
            empty="Nessuna partenza prevista oggi"
          />
        </Section>

        <Section title={`Ospiti in casa (${inCasa?.length ?? 0})`}>
          <Table
            headers={["#", "Ospite", "Camera", "Telefono", "Check-out"]}
            rows={
              inCasa?.map((b) => {
                const g = b.guests as { full_name: string; phone: string | null } | null
                const r = b.rooms as { name: string } | null
                return [
                  b.booking_number,
                  g?.full_name ?? "—",
                  r?.name ?? "—",
                  g?.phone ?? "—",
                  new Date(b.check_out).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "2-digit",
                  }),
                ]
              }) ?? []
            }
            empty="Nessun ospite in casa"
          />
        </Section>
      </div>
    </PrintFrame>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 border-b-2 border-slate-900 pb-1 text-sm font-extrabold uppercase tracking-wider text-slate-900">
        {title}
      </h2>
      {children}
    </section>
  )
}

function Table({
  headers,
  rows,
  empty,
}: {
  headers: string[]
  rows: (string | number)[][]
  empty: string
}) {
  if (rows.length === 0) {
    return <p className="py-3 text-xs italic text-slate-500">{empty}</p>
  }
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr>
          {headers.map((h) => (
            <th
              key={h}
              className="border-b border-slate-300 bg-slate-100 px-2 py-1.5 text-left font-bold uppercase tracking-wider text-slate-700"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-slate-200">
            {r.map((c, j) => (
              <td key={j} className="px-2 py-1.5 text-slate-800">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
