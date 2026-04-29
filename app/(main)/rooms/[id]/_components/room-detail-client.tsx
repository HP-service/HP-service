"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil, Check, X, Plus } from "lucide-react"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Textarea } from "@ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { updateRoom } from "@db/queries/settings"
import { createExpense } from "@db/queries/finance"

type Category = { id: string; name: string; color: string | null }

type Expense = {
  id: string
  description: string
  amount: number
  date: string
  vendor: string | null
  status: string
  notes: string | null
  category: Category | null
}

type Room = {
  id: string
  name: string
  notes: string | null
}

type Props = {
  room: Room
  expenses: Expense[]
  categories: Category[]
  propertyId: string
}

const STATUS_COLORS: Record<string, string> = {
  Pending:  "bg-yellow-100 text-yellow-800",
  Approved: "bg-blue-100 text-blue-800",
  Paid:     "bg-emerald-100 text-emerald-800",
  Rejected: "bg-red-100 text-red-800",
}

export function RoomDetailClient({ room, expenses, categories, propertyId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Notes editing
  const [editingNotes, setEditingNotes] = useState(false)
  const [notes, setNotes] = useState(room.notes ?? "")
  const [savedNotes, setSavedNotes] = useState(room.notes ?? "")

  // Expense form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    category_id: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    vendor: "",
    notes: "",
  })

  function handleCancelNotes() {
    setNotes(savedNotes)
    setEditingNotes(false)
  }

  function handleSaveNotes() {
    startTransition(async () => {
      const result = await updateRoom(room.id, { notes: notes || null })
      if (result.error) {
        toast.error(result.error)
      } else {
        setSavedNotes(notes)
        setEditingNotes(false)
        toast.success("Note salvate")
        router.refresh()
      }
    })
  }

  async function handleSubmitExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category_id || !form.description || !form.amount) {
      toast.error("Compila categoria, descrizione e importo")
      return
    }
    startTransition(async () => {
      const result = await createExpense(propertyId, {
        category_id: form.category_id,
        description: form.description,
        amount: parseFloat(form.amount),
        date: form.date,
        vendor: form.vendor || undefined,
        notes: form.notes || undefined,
        room_id: room.id,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Spesa registrata")
        setForm({
          category_id: "",
          description: "",
          amount: "",
          date: new Date().toISOString().split("T")[0],
          vendor: "",
          notes: "",
        })
        setShowForm(false)
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-4">
      {/* Note camera */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Note camera</CardTitle>
            {!editingNotes && (
              <button
                onClick={() => setEditingNotes(true)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" />
                Modifica
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {editingNotes ? (
            <div className="space-y-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Aggiungi note (es. chiamare idraulico, sostituire tendina bagno...)"
                rows={4}
                className="text-sm resize-none"
                autoFocus
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveNotes} disabled={isPending}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  {isPending ? "Salvataggio..." : "Salva"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelNotes} disabled={isPending}>
                  <X className="h-3.5 w-3.5 mr-1" />
                  Annulla
                </Button>
              </div>
            </div>
          ) : (
            <div
              onClick={() => setEditingNotes(true)}
              className="cursor-text min-h-[60px] rounded-md border border-dashed border-muted-foreground/30 p-3 text-sm hover:border-muted-foreground/60 transition-colors"
            >
              {savedNotes ? (
                <p className="whitespace-pre-wrap">{savedNotes}</p>
              ) : (
                <p className="text-muted-foreground italic">Nessuna nota. Clicca per aggiungere...</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Spese e manutenzione */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Spese e manutenzione</CardTitle>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Aggiungi spesa
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Form aggiunta spesa */}
          {showForm && (
            <form onSubmit={handleSubmitExpense} className="space-y-3 pb-4 border-b mb-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Categoria *</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Seleziona..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data *</Label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrizione *</Label>
                <Input
                  placeholder="es. Riparazione idraulico, sostituzione rubinetto..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Importo (€) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fornitore</Label>
                  <Input
                    placeholder="es. Idraulico Rossi"
                    value={form.vendor}
                    onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Note</Label>
                <Input
                  placeholder="Note aggiuntive..."
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Salvataggio..." : "Salva Spesa"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)} disabled={isPending}>
                  Annulla
                </Button>
              </div>
            </form>
          )}

          {/* Lista spese */}
          {expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna spesa registrata per questa camera.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Data</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Descrizione</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Categoria</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground text-xs">Stato</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground text-xs">Importo</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(e.date).toLocaleDateString("it-IT")}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium leading-tight">{e.description}</p>
                        {e.vendor && <p className="text-xs text-muted-foreground">{e.vendor}</p>}
                        {e.notes && <p className="text-xs text-muted-foreground italic">{e.notes}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        {e.category ? (
                          <div className="flex items-center gap-1.5">
                            {e.category.color && (
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: e.category.color }}
                              />
                            )}
                            <span className="text-xs">{e.category.name}</span>
                          </div>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[e.status] ?? "bg-muted"}`}>
                          {e.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right font-medium">
                        €{Number(e.amount).toLocaleString("it-IT")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
