import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getProfile } from "@auth/server"

/**
 * GET /api/archivio/export?month=YYYY-MM&type=alloggiati|istat|fattura|spesa
 * Genera CSV scaricabile con tutti i documenti del mese.
 */
export async function GET(request: Request) {
  const profile = await getProfile()
  if (!profile?.property_id) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
  }

  const url = new URL(request.url)
  const month = url.searchParams.get("month")
  const type = url.searchParams.get("type") ?? "all"

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Parametro month non valido" }, { status: 400 })
  }

  const [yearStr, monthStr] = month.split("-")
  const start = `${yearStr}-${monthStr}-01`
  const endDate = new Date(Number(yearStr), Number(monthStr), 0)
  const end = `${yearStr}-${monthStr}-${String(endDate.getDate()).padStart(2, "0")}`

  const supabase = await createClient()
  const pid = profile.property_id

  const rows: string[][] = [["Data", "Tipo", "Titolo", "Dettaglio", "Stato", "Importo"]]

  if (type === "all" || type === "alloggiati") {
    const { data } = await supabase
      .from("alloggiati_submissions")
      .select(
        "submitted_at, response_esito, schedine_count, schedine_valide, bookings:booking_id(booking_number, guests:guest_id(full_name))",
      )
      .eq("property_id", pid)
      .gte("submitted_at", start + "T00:00:00")
      .lte("submitted_at", end + "T23:59:59")
    for (const a of data ?? []) {
      const b = a.bookings as { booking_number: string; guests: { full_name: string } | null } | null
      rows.push([
        new Date(a.submitted_at).toLocaleDateString("it-IT"),
        "Alloggiati Web",
        `Schedina ${b?.booking_number ?? "—"}`,
        `${b?.guests?.full_name ?? "—"} · ${a.schedine_valide ?? a.schedine_count}/${a.schedine_count} schedine`,
        a.response_esito === true ? "OK" : a.response_esito === false ? "Errore" : "In attesa",
        "",
      ])
    }
  }

  if (type === "all" || type === "istat") {
    const { data } = await supabase
      .from("istat_submissions")
      .select("submitted_at, data_rilevazione, response_status, camere_occupate")
      .eq("property_id", pid)
      .gte("submitted_at", start + "T00:00:00")
      .lte("submitted_at", end + "T23:59:59")
    for (const i of data ?? []) {
      rows.push([
        new Date(i.submitted_at).toLocaleDateString("it-IT"),
        "ISTAT",
        `Rilevazione ${i.data_rilevazione}`,
        `${i.camere_occupate} camere occupate`,
        i.response_status === 200 ? "OK" : i.response_status ? "Errore" : "In attesa",
        "",
      ])
    }
  }

  if (type === "all" || type === "spesa") {
    const { data } = await supabase
      .from("expenses")
      .select("date, description, amount, vendor")
      .eq("property_id", pid)
      .gte("date", start)
      .lte("date", end)
    for (const e of data ?? []) {
      rows.push([
        new Date(e.date).toLocaleDateString("it-IT"),
        "Spesa",
        e.description ?? "Spesa",
        e.vendor ?? "—",
        "Pagata",
        Number(e.amount ?? 0).toFixed(2),
      ])
    }
  }

  if (type === "all" || type === "fattura") {
    const { data } = await supabase
      .from("payments")
      .select(
        "date, amount, type, folio:folio_id(folio_number, booking:booking_id(guests:guest_id(full_name)))",
      )
      .eq("property_id", pid)
      .gte("date", start)
      .lte("date", end)
    for (const t of data ?? []) {
      const folio = t.folio as {
        folio_number: string
        booking: { guests: { full_name: string } | null } | null
      } | null
      if (t.type === "Refund") continue
      rows.push([
        new Date(t.date).toLocaleDateString("it-IT"),
        "Pagamento",
        folio?.folio_number ?? "—",
        folio?.booking?.guests?.full_name ?? "—",
        "OK",
        Number(t.amount ?? 0).toFixed(2),
      ])
    }
  }

  // CSV — escape semplice (raddoppia virgolette se presenti)
  const csv =
    "﻿" +
    rows
      .map((r) =>
        r
          .map((c) => {
            const s = String(c ?? "")
            if (s.includes(";") || s.includes('"') || s.includes("\n")) {
              return `"${s.replace(/"/g, '""')}"`
            }
            return s
          })
          .join(";"),
      )
      .join("\n")

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="archivio-${month}${type !== "all" ? `-${type}` : ""}.csv"`,
    },
  })
}
