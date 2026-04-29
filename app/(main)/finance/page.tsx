export const dynamic = "force-dynamic"

import Link from "next/link"
import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import { getFinanceStats, getTransactions } from "@db/queries/finance"
import {
  TrendingUp, TrendingDown, ArrowDownLeft, ArrowUpRight, ArrowDownRight,
  ReceiptText, Euro, FileSpreadsheet
} from "lucide-react"
import { FinanceExport } from "./_components/finance-export"

function formatEur(value: number) {
  return "€ " + Math.round(value).toLocaleString("it-IT")
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  await requireRole(MAIN_APP_ROLES)
  const { month } = await searchParams

  const now = new Date()
  const currentMonth = month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [statsResult, txnsResult] = await Promise.all([
    getFinanceStats(currentMonth),
    getTransactions(50),
  ])

  const stats = statsResult.data
  const txns = txnsResult.data ?? []

  const monthLabel = new Date(currentMonth + "-01").toLocaleDateString("it-IT", {
    month: "long", year: "numeric",
  })

  // GOP% calcolato solo quando i dati sono significativi.
  // - Se non ci sono entrate nel mese (netRevenue ≤ 0) → N/D
  //   (un margine % su ricavi zero è matematicamente indefinito)
  // - Capping ai limiti sensati (±999%) per evitare valori assurdi
  //   tipo -1693% quando il dataset è parziale
  let marginDisplay: string = "—"
  if (stats && stats.netRevenue > 0) {
    const raw = Math.round((stats.grossProfit / stats.netRevenue) * 100)
    if (raw > 999)       marginDisplay = ">999%"
    else if (raw < -999) marginDisplay = "<-999%"
    else                 marginDisplay = `${raw}%`
  } else if (stats && stats.expenses > 0) {
    marginDisplay = "N/D"
  }

  // Generate last 12 months for selector
  const months: { value: string; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    months.push({
      value,
      label: d.toLocaleDateString("it-IT", { month: "short", year: "numeric" }),
    })
  }

  // Prepara dati per export
  const exportData = txns.map((t) => {
    const folio = t.folio as {
      folio_number: string
      booking: { id: string; booking_number: string; guest: { full_name: string } | null } | null
    } | null
    return {
      date: t.date ? new Date(t.date).toLocaleDateString("it-IT") : "—",
      guest_name: folio?.booking?.guest?.full_name ?? "—",
      booking_number: folio?.booking?.booking_number ?? folio?.folio_number ?? "—",
      method: t.method,
      type: t.type === "Refund" ? "Rimborso" : t.type === "Deposit" ? "Acconto" : "Saldo",
      amount: `${t.type === "Refund" ? "-" : ""}${Number(t.amount).toFixed(2)}`,
    }
  })

  const grossProfit = stats?.grossProfit ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-foreground capitalize">Finanze</h1>
          <p className="text-sm text-muted-foreground capitalize">Overview finanziaria · {monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <FinanceExport data={exportData} />
          <Link
            href="/finance/export-clienti"
            className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Export Fatture
          </Link>
          <Link
            href="/finance/expenses"
            className="inline-flex items-center rounded-xl border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            <ReceiptText className="mr-2 h-4 w-4" />
            Gestisci Spese
          </Link>
        </div>
      </div>

      {/* Month selector */}
      <div className="flex flex-wrap gap-1.5">
        {months.map((m) => (
          <Link
            key={m.value}
            href={`/finance?month=${m.value}`}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors font-medium ${
              m.value === currentMonth
                ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30"
                : "hover:bg-muted border-border text-muted-foreground"
            }`}
          >
            {m.label}
          </Link>
        ))}
      </div>

      {/* KPI Cards — Figma gradient style */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Entrate */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200/60 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <ArrowDownLeft className="h-5 w-5 text-blue-600" />
            </div>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
              <TrendingUp className="h-3 w-3" />
              Revenue
            </span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-blue-400 mb-1">Entrate Nette</p>
          <p className="text-3xl font-black text-blue-800">{formatEur(stats?.netRevenue ?? 0)}</p>
          {(stats?.refunds ?? 0) > 0 && (
            <p className="text-xs text-red-500 mt-0.5">Rimborsi: -{formatEur(stats?.refunds ?? 0)}</p>
          )}
          <p className="text-xs text-blue-400 mt-0.5">{monthLabel}</p>
        </div>

        {/* Spese */}
        <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200/60 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
              <ArrowUpRight className="h-5 w-5 text-red-500" />
            </div>
            <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
              <TrendingDown className="h-3 w-3" />
              Spese
            </span>
          </div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-red-400 mb-1">Spese Totali</p>
          <p className="text-3xl font-black text-red-800">{formatEur(stats?.expenses ?? 0)}</p>
          <p className="text-xs text-red-400 mt-0.5">{monthLabel}</p>
        </div>

        {/* Utile */}
        <div className={`bg-gradient-to-br ${grossProfit >= 0 ? "from-emerald-50 to-emerald-100 border-emerald-200/60" : "from-orange-50 to-orange-100 border-orange-200/60"} border rounded-2xl p-5`}>
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${grossProfit >= 0 ? "bg-emerald-500/15" : "bg-orange-500/15"}`}>
              <Euro className={`h-5 w-5 ${grossProfit >= 0 ? "text-emerald-600" : "text-orange-500"}`} />
            </div>
            <span className={`flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${grossProfit >= 0 ? "text-emerald-600 bg-emerald-100" : "text-orange-600 bg-orange-100"}`}>
              {grossProfit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {marginDisplay} GOP
            </span>
          </div>
          <p className={`text-[11px] font-bold uppercase tracking-widest mb-1 ${grossProfit >= 0 ? "text-emerald-500" : "text-orange-400"}`}>Utile Lordo</p>
          <p className={`text-3xl font-black ${grossProfit >= 0 ? "text-emerald-800" : "text-orange-800"}`}>{formatEur(grossProfit)}</p>
          <p className={`text-xs mt-0.5 ${grossProfit >= 0 ? "text-emerald-500" : "text-orange-400"}`}>{monthLabel}</p>
        </div>
      </div>

      {/* P&L Summary */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
        <h3 className="font-bold text-foreground mb-4 capitalize">Riepilogo P&L — {monthLabel}</h3>
        <div className="space-y-1 text-sm max-w-sm">
          <div className="flex justify-between py-2.5 border-b border-border/50">
            <span className="text-muted-foreground">Incassi lordi</span>
            <span className="font-semibold text-emerald-600">+ {formatEur(stats?.revenue ?? 0)}</span>
          </div>
          {(stats?.refunds ?? 0) > 0 && (
            <div className="flex justify-between py-2.5 border-b border-border/50">
              <span className="text-muted-foreground">Rimborsi</span>
              <span className="font-semibold text-red-500">- {formatEur(stats?.refunds ?? 0)}</span>
            </div>
          )}
          <div className="flex justify-between py-2.5 border-b border-border/50">
            <span className="font-semibold text-foreground">Revenue netto</span>
            <span className="font-bold text-foreground">{formatEur(stats?.netRevenue ?? 0)}</span>
          </div>
          <div className="flex justify-between py-2.5 border-b border-border/50">
            <span className="text-muted-foreground">Spese operative</span>
            <span className="font-semibold text-red-500">- {formatEur(stats?.expenses ?? 0)}</span>
          </div>
          <div className="flex justify-between py-3 mt-1 bg-muted/40 rounded-xl px-3 -mx-3">
            <span className="font-bold text-foreground">Utile Lordo Operativo</span>
            <span className={`font-black text-base ${grossProfit < 0 ? "text-red-500" : "text-emerald-600"}`}>
              {grossProfit >= 0 ? "+" : ""} {formatEur(grossProfit)}
            </span>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-bold text-foreground">Ultimi Movimenti</h3>
          <span className="text-xs text-muted-foreground font-medium">{txns.length} movimenti</span>
        </div>
        {txns.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">Nessun movimento registrato.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["Tipo", "Ospite / Prenotazione", "Metodo", "Data", "Importo"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {txns.map((t) => {
                  const folio = t.folio as {
                    folio_number: string
                    booking: { id: string; booking_number: string; guest: { full_name: string } | null } | null
                  } | null
                  const isRefund = t.type === "Refund"
                  const typeLabel = isRefund ? "Rimborso" : t.type === "Deposit" ? "Acconto" : "Saldo"
                  return (
                    <tr key={t.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isRefund ? "bg-red-100" : "bg-emerald-100"}`}>
                          {isRefund
                            ? <ArrowDownRight className="h-3.5 w-3.5 text-red-600" />
                            : <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
                          }
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {folio?.booking ? (
                          <Link href={`/bookings/${folio.booking.id}`} className="hover:underline">
                            <p className="text-sm font-semibold text-foreground">{folio.booking.guest?.full_name ?? "—"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{folio.booking.booking_number}</p>
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">{folio?.folio_number ?? "—"}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-xs bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-full font-medium">{t.method}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground font-medium whitespace-nowrap">
                        {t.date ? new Date(t.date).toLocaleDateString("it-IT", { day: "numeric", month: "short" }) : "—"}
                      </td>
                      <td className="py-3 px-4">
                        <p className={`text-sm font-bold ${isRefund ? "text-red-600" : "text-emerald-600"}`}>
                          {isRefund ? "- " : "+ "}{formatEur(Number(t.amount))}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{typeLabel}</p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
