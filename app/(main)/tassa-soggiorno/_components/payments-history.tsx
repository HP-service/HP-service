"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/select"
import {
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Receipt,
  Calendar,
  Loader2,
  FileCheck,
} from "lucide-react"
import { recordTaxPayment, deleteTaxPayment, type TaxPayment } from "../_actions"
import { toast } from "sonner"

export function PaymentsHistory({
  payments,
  currentMonth,
  currentMonthAmount,
}: {
  payments: TaxPayment[]
  currentMonth: string
  currentMonthAmount: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    period_month: currentMonth,
    amount: currentMonthAmount.toFixed(2),
    paid_at: new Date().toISOString().slice(0, 10),
    payment_method: "F24",
    reference: "",
    notes: "",
  })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await recordTaxPayment({
        period_month: form.period_month,
        amount: Number(form.amount),
        paid_at: form.paid_at,
        payment_method: form.payment_method,
        reference: form.reference || undefined,
        notes: form.notes || undefined,
      })
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Versamento registrato")
      setOpen(false)
      router.refresh()
    })
  }

  function onDelete(id: string) {
    if (!confirm("Eliminare questo versamento dallo storico?")) return
    startTransition(async () => {
      const r = await deleteTaxPayment(id)
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success("Versamento eliminato")
      router.refresh()
    })
  }

  const totalPaid = payments.reduce((s, p) => s + Number(p.amount), 0)
  const currentPaid = payments.find((p) => p.period_month === currentMonth)

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
            <FileCheck className="h-3.5 w-3.5 text-emerald-700" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Storico Versamenti F24</h3>
            <p className="text-[11px] text-muted-foreground">
              {payments.length} versamenti · totale € {totalPaid.toFixed(2)}
            </p>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Registra
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Registra versamento F24</DialogTitle>
            </DialogHeader>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block">Mese di riferimento</label>
                  <input
                    type="month"
                    required
                    value={form.period_month}
                    onChange={(e) => setForm({ ...form, period_month: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">Data versamento</label>
                  <input
                    type="date"
                    required
                    value={form.paid_at}
                    onChange={(e) => setForm({ ...form, paid_at: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold mb-1 block">Importo (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold mb-1 block">Metodo</label>
                  <Select
                    value={form.payment_method}
                    onValueChange={(v) => setForm({ ...form, payment_method: v })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F24">F24</SelectItem>
                      <SelectItem value="PagoPA">PagoPA</SelectItem>
                      <SelectItem value="BonificoBancario">Bonifico</SelectItem>
                      <SelectItem value="Altro">Altro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Protocollo / CRO</label>
                <input
                  type="text"
                  value={form.reference}
                  onChange={(e) => setForm({ ...form, reference: e.target.value })}
                  placeholder="es. CRO 12345678"
                  className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block">Note</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Annulla
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stato mese corrente */}
      <div
        className={`px-5 py-3 border-b text-xs font-semibold flex items-center gap-2 ${
          currentPaid
            ? "bg-emerald-50 border-emerald-100 text-emerald-700"
            : "bg-amber-50 border-amber-100 text-amber-700"
        }`}
      >
        {currentPaid ? (
          <>
            <CheckCircle2 className="h-4 w-4" />
            Mese corrente versato il {new Date(currentPaid.paid_at).toLocaleDateString("it-IT")} · €{" "}
            {Number(currentPaid.amount).toFixed(2)}
          </>
        ) : (
          <>
            <Clock className="h-4 w-4" />
            Mese corrente da versare: € {currentMonthAmount.toFixed(2)}
          </>
        )}
      </div>

      {payments.length === 0 ? (
        <div className="p-8 text-center">
          <Receipt className="mx-auto h-10 w-10 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            Nessun versamento registrato. Usa &laquo;Registra&raquo; per iniziare.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/20">
                <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Periodo
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Versato il
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Metodo
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Protocollo
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Importo
                </th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => {
                const periodLabel = new Date(p.period_month + "-01").toLocaleDateString("it-IT", {
                  month: "long",
                  year: "numeric",
                })
                return (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 capitalize">
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-emerald-600" />
                        <span className="font-semibold">{periodLabel}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(p.paid_at).toLocaleDateString("it-IT")}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5 font-semibold">
                        {p.payment_method ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                      {p.reference ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      € {Number(p.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onDelete(p.id)}
                        disabled={isPending}
                        title="Elimina"
                        className="p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
