"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@ui/button"
import { Badge } from "@ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@ui/dialog"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Switch } from "@ui/switch"
import { createChannel, updateChannel, deleteChannel } from "@db/queries/settings"
import { bookingChannelSchema } from "@db/schema"

type Channel = {
  id: string
  name: string
  commission_rate: number
  is_active: boolean
}

type Props = {
  propertyId: string
  channels: Channel[]
}

type FormValues = z.infer<typeof bookingChannelSchema>

export function ChannelsManager({ propertyId, channels }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Channel | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(bookingChannelSchema),
    defaultValues: { name: "", commission_rate: 0, is_active: true },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: "", commission_rate: 0, is_active: true })
    setOpen(true)
  }

  function openEdit(ch: Channel) {
    setEditing(ch)
    form.reset({
      name: ch.name,
      commission_rate: ch.commission_rate,
      is_active: ch.is_active,
    })
    setOpen(true)
  }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = editing
        ? await updateChannel(editing.id, values)
        : await createChannel(propertyId, values)

      if (result.error) toast.error(result.error)
      else {
        toast.success(editing ? "Canale aggiornato" : "Canale creato")
        setOpen(false)
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm("Eliminare questo canale?")) return
    startTransition(async () => {
      const result = await deleteChannel(id)
      if (result.error) toast.error(result.error)
      else toast.success("Canale eliminato")
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{channels.length} canali configurati</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Nuovo Canale
        </Button>
      </div>

      <div className="rounded-lg border">
        {channels.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nessun canale. Crea il primo.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Canale</th>
                <th className="px-4 py-3 text-center font-medium">Commissione</th>
                <th className="px-4 py-3 text-center font-medium">Stato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{ch.name}</td>
                  <td className="px-4 py-3 text-center">
                    {Number(ch.commission_rate) > 0
                      ? `${Number(ch.commission_rate).toFixed(1)}%`
                      : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={ch.is_active ? "default" : "secondary"}>
                      {ch.is_active ? "Attivo" : "Inattivo"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ch)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(ch.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica Canale" : "Nuovo Canale"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome canale *</Label>
              <Input {...form.register("name")} placeholder="es. Booking.com" />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Commissione (%)</Label>
              <Input type="number" step="0.1" min={0} max={100} {...form.register("commission_rate")} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Canale attivo</Label>
              <Switch
                checked={form.watch("is_active")}
                onCheckedChange={(v) => form.setValue("is_active", v)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Salvataggio..." : editing ? "Aggiorna" : "Crea"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
