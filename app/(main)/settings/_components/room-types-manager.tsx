"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, X } from "lucide-react"
import { Button } from "@ui/button"
import { Badge } from "@ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@ui/dialog"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Switch } from "@ui/switch"
import { createRoomType, updateRoomType, deleteRoomType } from "@db/queries/settings"
import { roomTypeSchema } from "@db/schema"

type RoomType = {
  id: string
  name: string
  short_code: string | null
  description: string | null
  default_capacity: number
  max_capacity: number
  base_price: number
  amenities: string[]
  is_active: boolean
  sort_order: number
}

type Props = {
  propertyId: string
  roomTypes: RoomType[]
}

type FormValues = z.infer<typeof roomTypeSchema>

export function RoomTypesManager({ propertyId, roomTypes }: Props) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<RoomType | null>(null)
  const [amenityInput, setAmenityInput] = useState("")
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: {
      name: "",
      short_code: "",
      description: "",
      default_capacity: 2,
      max_capacity: 3,
      base_price: 100,
      amenities: [],
      is_active: true,
      sort_order: 0,
    },
  })

  const amenities = form.watch("amenities")

  function openCreate() {
    setEditing(null)
    form.reset({
      name: "", short_code: "", description: "",
      default_capacity: 2, max_capacity: 3, base_price: 100,
      amenities: [], is_active: true, sort_order: 0,
    })
    setOpen(true)
  }

  function openEdit(rt: RoomType) {
    setEditing(rt)
    form.reset({
      name: rt.name,
      short_code: rt.short_code ?? "",
      description: rt.description ?? "",
      default_capacity: rt.default_capacity,
      max_capacity: rt.max_capacity,
      base_price: rt.base_price,
      amenities: rt.amenities ?? [],
      is_active: rt.is_active,
      sort_order: rt.sort_order,
    })
    setOpen(true)
  }

  function addAmenity() {
    const v = amenityInput.trim()
    if (!v) return
    const current = form.getValues("amenities") ?? []
    if (!current.includes(v)) {
      form.setValue("amenities", [...current, v])
    }
    setAmenityInput("")
  }

  function removeAmenity(a: string) {
    const current = form.getValues("amenities") ?? []
    form.setValue("amenities", current.filter((x) => x !== a))
  }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = editing
        ? await updateRoomType(editing.id, values)
        : await createRoomType(propertyId, values)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(editing ? "Tipologia aggiornata" : "Tipologia creata")
        setOpen(false)
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm("Eliminare questa tipologia? Verranno rimosse tutte le assegnazioni.")) return
    startTransition(async () => {
      const result = await deleteRoomType(id)
      if (result.error) toast.error(result.error)
      else toast.success("Tipologia eliminata")
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {roomTypes.length} tipologie configurate
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Nuova Tipologia
        </Button>
      </div>

      <div className="rounded-lg border">
        {roomTypes.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nessuna tipologia. Crea la prima.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Nome</th>
                <th className="px-4 py-3 text-left font-medium">Codice</th>
                <th className="px-4 py-3 text-center font-medium">Cap.</th>
                <th className="px-4 py-3 text-right font-medium">Prezzo base</th>
                <th className="px-4 py-3 text-center font-medium">Stato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((rt) => (
                <tr key={rt.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{rt.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{rt.short_code ?? "—"}</td>
                  <td className="px-4 py-3 text-center">{rt.default_capacity}</td>
                  <td className="px-4 py-3 text-right">€{Number(rt.base_price).toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={rt.is_active ? "default" : "secondary"}>
                      {rt.is_active ? "Attiva" : "Inattiva"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(rt)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(rt.id)}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica Tipologia" : "Nuova Tipologia"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input {...form.register("name")} placeholder="es. Doppia Standard" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Codice breve</Label>
                <Input {...form.register("short_code")} placeholder="es. DBL" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Descrizione</Label>
              <Input {...form.register("description")} placeholder="Descrizione opzionale" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Cap. default</Label>
                <Input type="number" {...form.register("default_capacity")} min={1} />
              </div>
              <div className="space-y-1.5">
                <Label>Cap. max</Label>
                <Input type="number" {...form.register("max_capacity")} min={1} />
              </div>
              <div className="space-y-1.5">
                <Label>Prezzo base (€)</Label>
                <Input type="number" step="0.01" {...form.register("base_price")} min={0} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Servizi</Label>
              <div className="flex gap-2">
                <Input
                  value={amenityInput}
                  onChange={(e) => setAmenityInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addAmenity() } }}
                  placeholder="es. Wifi, Balcone..."
                />
                <Button type="button" variant="outline" onClick={addAmenity}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {amenities && amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {amenities.map((a) => (
                    <Badge key={a} variant="secondary" className="gap-1">
                      {a}
                      <button type="button" onClick={() => removeAmenity(a)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Tipologia attiva</Label>
              <Switch
                id="is_active"
                checked={form.watch("is_active")}
                onCheckedChange={(v) => form.setValue("is_active", v)}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annulla
              </Button>
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
