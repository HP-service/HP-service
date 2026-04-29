"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Filter, Check, X } from "lucide-react"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { createExpense, updateExpense, deleteExpense } from "@db/queries/finance"

type Category = {
  id: string
  name: string
  color: string | null
}

type Expense = {
  id: string
  description: string
  amount: number
  date: string
  vendor: string | null
  status: string
  category: Category | null
  room: { name: string } | null
  notes: string | null
}

type Props = {
  expenses: Expense[]
  categories: Category[]
  propertyId: string
  currentFilters: { from?: string; to?: string; category_id?: string }
}

const STATUS_COLORS: Record<string, string> = {
  Pending:  "bg-yellow-100 text-yellow-800",
  Approved: "bg-blue-100 text-blue-800",
  Paid:     "bg-emerald-100 text-emerald-800",
  Rejected: "bg-red-100 text-red-800",
}

export function ExpensesClient({ expenses, categories, propertyId, currentFilters }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Form state (create)
  const [form, setForm] = useState({
    category_id: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    vendor: "",
    notes: "",
  })

  // Edit form state
  const [editForm, setEditForm] = useState({
    category_id: "",
    description: "",
    amount: "",
    date: "",
    vendor: "",
    notes: "",
  })

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams()
    if (currentFilters.from) params.set("from", currentFilters.from)
    if (currentFilters.to) params.set("to", currentFilters.to)
    if (currentFilters.category_id) params.set("category_id", currentFilters.category_id)
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`/finance/expenses?${params.toString()}`)
  }

  function clearFilters() {
    router.push("/finance/expenses")
  }

  async function handleSubmit(e: React.FormEvent) {
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
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Spesa registrata")
        setForm({ category_id: "", description: "", amount: "", date: new Date().toISOString().split("T")[0], vendor: "", notes: "" })
        setShowForm(false)
        router.refresh()
      }
    })
  }

  function startEdit(expense: Expense) {
    setEditingId(expense.id)
    setEditForm({
      category_id: expense.category?.id ?? "",
      description: expense.description,
      amount: String(expense.amount),
      date: expense.date,
      vendor: expense.vendor ?? "",
      notes: expense.notes ?? "",
    })
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.description || !editForm.amount) {
      toast.error("Descrizione e importo sono obbligatori")
      return
    }
    startTransition(async () => {
      const result = await updateExpense(id, {
        category_id: editForm.category_id || undefined,
        description: editForm.description,
        amount: parseFloat(editForm.amount),
        date: editForm.date,
        vendor: editForm.vendor || null,
        notes: editForm.notes || null,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Spesa aggiornata")
        setEditingId(null)
        router.refresh()
      }
    })
  }

  async function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteExpense(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Spesa eliminata")
        setDeletingId(null)
        router.refresh()
      }
    })
  }

  const hasFilters = currentFilters.from || currentFilters.to || currentFilters.category_id

  return (
    <div className="space-y-4">
      {/* Filtri */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtri
            </CardTitle>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
                Rimuovi filtri
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">Dal</Label>
              <Input
                type="date"
                defaultValue={currentFilters.from ?? ""}
                onChange={(e) => updateFilter("from", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Al</Label>
              <Input
                type="date"
                defaultValue={currentFilters.to ?? ""}
                onChange={(e) => updateFilter("to", e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select
                defaultValue={currentFilters.category_id ?? ""}
                onValueChange={(v) => updateFilter("category_id", v === "_all" ? "" : v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Tutte" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_all">Tutte</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aggiungi spesa */}
      {showForm ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nuova Spesa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Categoria *</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm((f) => ({ ...f, category_id: v }))}>
                    <SelectTrigger className="h-9">
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
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrizione *</Label>
                <Input
                  placeholder="es. Bolletta luce marzo"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="h-9"
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
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fornitore</Label>
                  <Input
                    placeholder="es. Enel Energia"
                    value={form.vendor}
                    onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Note</Label>
                <Input
                  placeholder="Note opzionali"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  className="h-9"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? "Salvataggio..." : "Salva Spesa"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  Annulla
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button size="sm" onClick={() => setShowForm(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Aggiungi Spesa
        </Button>
      )}

      {/* Lista spese */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Spese ({expenses.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {expenses.length === 0 ? (
            <p className="px-6 pb-6 text-sm text-muted-foreground">Nessuna spesa trovata.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Data</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Descrizione</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Categoria</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Fornitore</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">Stato</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Importo</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => {
                    const cat = e.category
                    const isEditing = editingId === e.id
                    const isDeleting = deletingId === e.id

                    if (isEditing) {
                      return (
                        <tr key={e.id} className="border-b last:border-0 bg-blue-50/50">
                          <td className="px-4 py-2">
                            <Input
                              type="date"
                              value={editForm.date}
                              onChange={(ev) => setEditForm((f) => ({ ...f, date: ev.target.value }))}
                              className="h-8 text-xs w-32"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <div className="space-y-1">
                              <Input
                                value={editForm.description}
                                onChange={(ev) => setEditForm((f) => ({ ...f, description: ev.target.value }))}
                                className="h-8 text-xs"
                                placeholder="Descrizione"
                              />
                              <Input
                                value={editForm.notes}
                                onChange={(ev) => setEditForm((f) => ({ ...f, notes: ev.target.value }))}
                                className="h-7 text-xs"
                                placeholder="Note (opzionale)"
                              />
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <Select value={editForm.category_id} onValueChange={(v) => setEditForm((f) => ({ ...f, category_id: v }))}>
                              <SelectTrigger className="h-8 text-xs w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((c) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              value={editForm.vendor}
                              onChange={(ev) => setEditForm((f) => ({ ...f, vendor: ev.target.value }))}
                              className="h-8 text-xs w-28"
                              placeholder="Fornitore"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[e.status] ?? "bg-muted"}`}>
                              {e.status}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <Input
                              type="number"
                              step="0.01"
                              value={editForm.amount}
                              onChange={(ev) => setEditForm((f) => ({ ...f, amount: ev.target.value }))}
                              className="h-8 text-xs w-24 text-right"
                            />
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => handleSaveEdit(e.id)}
                                disabled={isPending}
                                title="Salva"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={cancelEdit}
                                title="Annulla"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    }

                    return (
                      <tr key={e.id} className="border-b last:border-0 hover:bg-muted/20 group">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(e.date).toLocaleDateString("it-IT")}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium leading-tight">{e.description}</p>
                          {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                          {e.room && <p className="text-xs text-muted-foreground">Camera {e.room.name}</p>}
                        </td>
                        <td className="px-4 py-3">
                          {cat ? (
                            <div className="flex items-center gap-1.5">
                              {cat.color && (
                                <span
                                  className="h-2 w-2 rounded-full shrink-0"
                                  style={{ backgroundColor: cat.color }}
                                />
                              )}
                              <span className="text-xs">{cat.name}</span>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{e.vendor ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[e.status] ?? "bg-muted"}`}>
                            {e.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          €{Number(e.amount).toLocaleString("it-IT")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isDeleting ? (
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-xs text-red-600 mr-1">Elimina?</span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDelete(e.id)}
                                disabled={isPending}
                                title="Conferma eliminazione"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                                onClick={() => setDeletingId(null)}
                                title="Annulla"
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => startEdit(e)}
                                title="Modifica"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                onClick={() => setDeletingId(e.id)}
                                title="Elimina"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
