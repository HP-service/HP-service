"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Trash2, CreditCard } from "lucide-react"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Separator } from "@ui/separator"
import { addInvoiceItem, deleteInvoiceItem, addTransaction } from "@db/queries/finance"

type InvoiceItem = {
  id: string
  description: string
  category: string | null
  quantity: number
  unit_price: number
  total_gross: number
  date: string
}

type Transaction = {
  id: string
  amount: number
  method: string
  type: string
  reference: string | null
  date: string
}

type Folio = {
  id: string
  folio_number: string
  status: string
  invoice_items: InvoiceItem[]
  transactions: Transaction[]
}

type Props = {
  folio: Folio
  bookingId: string
}

const PAYMENT_METHODS = ["Cash", "CreditCard", "BankTransfer", "OTAVirtualCard", "Satispay", "Other"]
const METHOD_LABELS: Record<string, string> = {
  Cash: "Contanti",
  CreditCard: "Carta di credito",
  BankTransfer: "Bonifico",
  OTAVirtualCard: "Carta virtuale OTA",
  Satispay: "Satispay",
  Other: "Altro",
}

export function FolioSection({ folio, bookingId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showAddItem, setShowAddItem] = useState(false)
  const [showAddPayment, setShowAddPayment] = useState(false)

  // Add item form state
  const [itemDesc, setItemDesc] = useState("")
  const [itemQty, setItemQty] = useState("1")
  const [itemPrice, setItemPrice] = useState("")

  // Add payment form state
  const [payAmount, setPayAmount] = useState("")
  const [payMethod, setPayMethod] = useState("Cash")
  const [payRef, setPayRef] = useState("")

  const totalBilled = folio.invoice_items.reduce((sum, i) => sum + Number(i.total_gross), 0)
  const totalPaid = folio.transactions
    .filter((t) => t.type !== "Refund")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const totalRefunded = folio.transactions
    .filter((t) => t.type === "Refund")
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const balance = totalBilled - totalPaid + totalRefunded

  function handleAddItem() {
    if (!itemDesc || !itemPrice) return
    startTransition(async () => {
      const result = await addInvoiceItem({
        folio_id: folio.id,
        description: itemDesc,
        quantity: Number(itemQty),
        unit_price: Number(itemPrice),
      })
      if (result.error) toast.error(result.error)
      else {
        toast.success("Extra aggiunto")
        setItemDesc(""); setItemQty("1"); setItemPrice("")
        setShowAddItem(false)
        router.refresh()
      }
    })
  }

  function handleDeleteItem(id: string) {
    startTransition(async () => {
      const result = await deleteInvoiceItem(id)
      if (result.error) toast.error(result.error)
      else { toast.success("Riga eliminata"); router.refresh() }
    })
  }

  function handleAddPayment() {
    if (!payAmount || Number(payAmount) <= 0) return
    startTransition(async () => {
      const result = await addTransaction({
        folio_id: folio.id,
        amount: Number(payAmount),
        method: payMethod,
        type: "Settlement",
        reference: payRef || undefined,
      })
      if (result.error) toast.error(result.error)
      else {
        toast.success("Pagamento registrato")
        setPayAmount(""); setPayRef("")
        setShowAddPayment(false)
        router.refresh()
      }
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          Conto — {folio.folio_number}
        </CardTitle>
        <span className={`text-sm font-medium ${balance > 0 ? "text-destructive" : "text-green-600"}`}>
          Saldo: {balance > 0 ? `-€${balance.toFixed(2)}` : `€${Math.abs(balance).toFixed(2)}`}
        </span>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Invoice items */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Voci fattura</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAddItem(!showAddItem)}>
              <Plus className="mr-1 h-3 w-3" />
              Aggiungi extra
            </Button>
          </div>

          {showAddItem && (
            <div className="rounded-lg border p-3 mb-3 space-y-2 bg-muted/30">
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-1 space-y-1">
                  <Label className="text-xs">Qtà</Label>
                  <Input type="number" min="1" value={itemQty} onChange={(e) => setItemQty(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="col-span-1 space-y-1">
                  <Label className="text-xs">Prezzo (€)</Label>
                  <Input type="number" step="0.01" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} className="h-8 text-sm" placeholder="0.00" />
                </div>
                <div className="col-span-1 space-y-1">
                  <Label className="text-xs invisible">Salva</Label>
                  <Button type="button" size="sm" className="h-8 w-full" onClick={handleAddItem} disabled={isPending}>
                    Aggiungi
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrizione</Label>
                <Input value={itemDesc} onChange={(e) => setItemDesc(e.target.value)} className="h-8 text-sm" placeholder="Es. Minibar, parcheggio..." />
              </div>
            </div>
          )}

          {folio.invoice_items.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessuna voce</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {folio.invoice_items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-2">{item.description}</td>
                    <td className="py-2 text-muted-foreground text-xs">×{item.quantity}</td>
                    <td className="py-2 text-right font-medium">€{Number(item.total_gross).toFixed(2)}</td>
                    <td className="py-2 pl-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDeleteItem(item.id)} disabled={isPending}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td colSpan={2} className="pt-2 text-muted-foreground text-xs">TOTALE</td>
                  <td className="pt-2 text-right">€{totalBilled.toFixed(2)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          )}
        </div>

        <Separator />

        {/* Transactions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Pagamenti</p>
            <Button type="button" size="sm" variant="outline" onClick={() => setShowAddPayment(!showAddPayment)}>
              <CreditCard className="mr-1 h-3 w-3" />
              Registra pagamento
            </Button>
          </div>

          {showAddPayment && (
            <div className="rounded-lg border p-3 mb-3 space-y-2 bg-muted/30">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Importo (€)</Label>
                  <Input type="number" step="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} className="h-8 text-sm" placeholder="0.00" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Metodo</Label>
                  <Select value={payMethod} onValueChange={setPayMethod}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>{METHOD_LABELS[m] ?? m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Input value={payRef} onChange={(e) => setPayRef(e.target.value)} className="h-8 text-sm flex-1" placeholder="Riferimento (opzionale)" />
                <Button type="button" size="sm" className="h-8" onClick={handleAddPayment} disabled={isPending}>
                  Salva
                </Button>
              </div>
            </div>
          )}

          {folio.transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nessun pagamento</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {folio.transactions.map((t) => (
                  <tr key={t.id} className="border-b last:border-0">
                    <td className="py-2 text-muted-foreground text-xs">{t.date}</td>
                    <td className="py-2">{METHOD_LABELS[t.method] ?? t.method}</td>
                    <td className="py-2 text-xs text-muted-foreground">{t.reference}</td>
                    <td className={`py-2 text-right font-medium ${t.type === "Refund" ? "text-destructive" : "text-green-600"}`}>
                      {t.type === "Refund" ? "-" : "+"}€{Number(t.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td colSpan={3} className="pt-2 text-muted-foreground text-xs">TOTALE PAGATO</td>
                  <td className="pt-2 text-right text-green-600">€{totalPaid.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
