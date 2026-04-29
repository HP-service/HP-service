"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Textarea } from "@ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ui/dialog"
import { deleteBooking, updateBooking } from "@db/queries/bookings"

type Props = {
  bookingId: string
  bookingNumber: string
  initial: {
    check_in: string
    check_out: string
    adults: number
    children: number
    total_amount: number | null
    special_requests: string | null
    internal_notes: string | null
  }
}

export function BookingEditDelete({ bookingId, bookingNumber, initial }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editOpen, setEditOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const [form, setForm] = useState({
    check_in: initial.check_in,
    check_out: initial.check_out,
    adults: initial.adults,
    children: initial.children,
    total_amount: initial.total_amount ?? 0,
    special_requests: initial.special_requests ?? "",
    internal_notes: initial.internal_notes ?? "",
  })

  function handleSave() {
    if (form.check_out <= form.check_in) {
      toast.error("La data di check-out deve essere successiva al check-in")
      return
    }
    if (form.adults < 1) {
      toast.error("Almeno 1 adulto è obbligatorio")
      return
    }

    startTransition(async () => {
      const result = await updateBooking(bookingId, {
        check_in: form.check_in,
        check_out: form.check_out,
        adults: Number(form.adults),
        children: Number(form.children),
        total_amount: Number(form.total_amount),
        special_requests: form.special_requests || null,
        internal_notes: form.internal_notes || null,
      })
      if (result.error) toast.error(result.error)
      else {
        toast.success("Prenotazione aggiornata")
        setEditOpen(false)
        router.refresh()
      }
    })
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteBooking(bookingId)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Prenotazione eliminata")
      setDeleteOpen(false)
      router.push("/bookings")
      router.refresh()
    })
  }

  return (
    <>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setEditOpen(true)}
        >
          <Pencil className="h-4 w-4 mr-1.5" />
          Modifica
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setDeleteOpen(true)}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Elimina
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Modifica prenotazione {bookingNumber}</DialogTitle>
            <DialogDescription>
              Aggiorna date, ospiti, importo e note. Lo stato della prenotazione non viene modificato qui.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-check-in">Check-in</Label>
              <Input
                id="edit-check-in"
                type="date"
                value={form.check_in}
                onChange={(e) => setForm({ ...form, check_in: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-check-out">Check-out</Label>
              <Input
                id="edit-check-out"
                type="date"
                value={form.check_out}
                onChange={(e) => setForm({ ...form, check_out: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-adults">Adulti</Label>
              <Input
                id="edit-adults"
                type="number"
                min={1}
                value={form.adults}
                onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-children">Bambini</Label>
              <Input
                id="edit-children"
                type="number"
                min={0}
                value={form.children}
                onChange={(e) => setForm({ ...form, children: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="edit-total">Importo totale (€)</Label>
              <Input
                id="edit-total"
                type="number"
                min={0}
                step="0.01"
                value={form.total_amount}
                onChange={(e) => setForm({ ...form, total_amount: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="edit-special">Richieste speciali</Label>
              <Textarea
                id="edit-special"
                rows={2}
                value={form.special_requests}
                onChange={(e) => setForm({ ...form, special_requests: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="edit-notes">Note interne</Label>
              <Textarea
                id="edit-notes"
                rows={2}
                value={form.internal_notes}
                onChange={(e) => setForm({ ...form, internal_notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={isPending}>
              Annulla
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Salvataggio..." : "Salva modifiche"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminare la prenotazione?</DialogTitle>
            <DialogDescription>
              Stai per eliminare definitivamente la prenotazione <strong>{bookingNumber}</strong>.
              Verranno rimossi anche folio, fatture e voci collegate. L&apos;operazione è irreversibile.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            Suggerimento: se la prenotazione è stata confermata ma non si presenterà, usa
            <strong> Cancella </strong> o <strong>No-show</strong> invece di eliminarla.
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Eliminazione..." : "Sì, elimina"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
