"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, X, Link2 } from "lucide-react"
import { Button } from "@ui/button"
import { Badge } from "@ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@ui/dialog"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { createRoom, updateRoom, deleteRoom, assignRoomType, removeRoomTypeAssignment } from "@db/queries/settings"
import { roomSchema } from "@db/schema"

type RoomTypeAssignment = {
  id: string
  room_type_id: string
  priority: number
  is_active: boolean
  room_types: { id: string; name: string; short_code: string | null } | null
}

type Room = {
  id: string
  name: string
  floor: number | null
  status: string
  cleaning_status: string
  notes: string | null
  sort_order: number
  room_type_assignments: RoomTypeAssignment[]
}

type RoomType = {
  id: string
  name: string
  short_code: string | null
}

type Props = {
  propertyId: string
  rooms: Room[]
  roomTypes: RoomType[]
}

type FormValues = z.infer<typeof roomSchema>

const STATUS_LABELS: Record<string, string> = {
  Available: "Disponibile",
  Occupied: "Occupata",
  Maintenance: "Manutenzione",
  OutOfOrder: "Fuori servizio",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Available: "default",
  Occupied: "secondary",
  Maintenance: "outline",
  OutOfOrder: "destructive",
}

const CLEANING_LABELS: Record<string, string> = {
  Clean: "Pulita",
  Dirty: "Sporca",
  Inspection: "Ispezione",
  InProgress: "In corso",
}

export function RoomsManager({ propertyId, rooms, roomTypes }: Props) {
  const [open, setOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [editing, setEditing] = useState<Room | null>(null)
  const [assigningRoom, setAssigningRoom] = useState<Room | null>(null)
  const [selectedTypeId, setSelectedTypeId] = useState("")
  const [selectedPriority, setSelectedPriority] = useState("1")
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: { name: "", floor: undefined, status: "Available", cleaning_status: "Clean", notes: "", features: [], sort_order: 0 },
  })

  function openCreate() {
    setEditing(null)
    form.reset({ name: "", floor: undefined, status: "Available", cleaning_status: "Clean", notes: "", features: [], sort_order: 0 })
    setOpen(true)
  }

  function openEdit(room: Room) {
    setEditing(room)
    form.reset({
      name: room.name,
      floor: room.floor ?? undefined,
      status: room.status as FormValues["status"],
      cleaning_status: room.cleaning_status as FormValues["cleaning_status"],
      notes: room.notes ?? "",
      features: [],
      sort_order: room.sort_order,
    })
    setOpen(true)
  }

  function openAssign(room: Room) {
    setAssigningRoom(room)
    setSelectedTypeId("")
    setSelectedPriority("1")
    setAssignOpen(true)
  }

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = editing
        ? await updateRoom(editing.id, values)
        : await createRoom(propertyId, values)

      if (result.error) toast.error(result.error)
      else {
        toast.success(editing ? "Camera aggiornata" : "Camera creata")
        setOpen(false)
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm("Eliminare questa camera? Verranno rimosse tutte le prenotazioni associate.")) return
    startTransition(async () => {
      const result = await deleteRoom(id)
      if (result.error) toast.error(result.error)
      else toast.success("Camera eliminata")
    })
  }

  function handleAssign() {
    if (!assigningRoom || !selectedTypeId) return
    startTransition(async () => {
      const result = await assignRoomType(assigningRoom.id, selectedTypeId, Number(selectedPriority))
      if (result.error) toast.error(result.error)
      else {
        toast.success("Tipologia assegnata")
        setAssignOpen(false)
      }
    })
  }

  function handleRemoveAssignment(id: string) {
    if (!confirm("Rimuovere questa assegnazione?")) return
    startTransition(async () => {
      const result = await removeRoomTypeAssignment(id)
      if (result.error) toast.error(result.error)
      else toast.success("Assegnazione rimossa")
    })
  }

  // For the assign dialog: filter out already-assigned types
  const assignedTypeIds = assigningRoom?.room_type_assignments.map((a) => a.room_type_id) ?? []
  const availableToAssign = roomTypes.filter((rt) => !assignedTypeIds.includes(rt.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{rooms.length} camere configurate</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Nuova Camera
        </Button>
      </div>

      <div className="rounded-lg border">
        {rooms.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nessuna camera. Crea la prima.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium">Camera</th>
                <th className="px-4 py-3 text-left font-medium">Piano</th>
                <th className="px-4 py-3 text-left font-medium">Stato</th>
                <th className="px-4 py-3 text-left font-medium">Pulizia</th>
                <th className="px-4 py-3 text-left font-medium">Tipologie</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rooms.map((room) => (
                <tr key={room.id} className="border-b last:border-0 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{room.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {room.floor != null ? `P${room.floor}` : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANTS[room.status] ?? "outline"}>
                      {STATUS_LABELS[room.status] ?? room.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {CLEANING_LABELS[room.cleaning_status] ?? room.cleaning_status}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {room.room_type_assignments
                        .sort((a, b) => a.priority - b.priority)
                        .map((a) => (
                          <Badge key={a.id} variant="secondary" className="gap-1 text-xs">
                            {a.room_types?.short_code ?? a.room_types?.name ?? "?"}
                            <span className="text-muted-foreground">#{a.priority}</span>
                            <button
                              type="button"
                              className="ml-0.5 hover:text-destructive"
                              onClick={() => handleRemoveAssignment(a.id)}
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </Badge>
                        ))}
                      <button
                        type="button"
                        className="inline-flex items-center gap-0.5 rounded border border-dashed px-1.5 py-0.5 text-xs text-muted-foreground hover:border-foreground hover:text-foreground"
                        onClick={() => openAssign(room)}
                      >
                        <Plus className="h-2.5 w-2.5" />
                        Aggiungi
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(room)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDelete(room.id)}
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

      {/* Create / Edit Room Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Modifica Camera" : "Nuova Camera"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nome *</Label>
                <Input {...form.register("name")} placeholder="es. 101" />
                {form.formState.errors.name && (
                  <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Piano</Label>
                <Input type="number" {...form.register("floor")} placeholder="0" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Stato</Label>
                <Select
                  value={form.watch("status")}
                  onValueChange={(v) => form.setValue("status", v as FormValues["status"])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pulizia</Label>
                <Select
                  value={form.watch("cleaning_status")}
                  onValueChange={(v) => form.setValue("cleaning_status", v as FormValues["cleaning_status"])}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CLEANING_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Note</Label>
              <Input {...form.register("notes")} placeholder="Note opzionali" />
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

      {/* Assign Room Type Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              <span className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Assegna Tipologia — Camera {assigningRoom?.name}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {availableToAssign.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tutte le tipologie sono già assegnate a questa camera.
              </p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label>Tipologia</Label>
                  <Select value={selectedTypeId} onValueChange={setSelectedTypeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona tipologia..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableToAssign.map((rt) => (
                        <SelectItem key={rt.id} value={rt.id}>
                          {rt.name}{rt.short_code ? ` (${rt.short_code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priorità</Label>
                  <Input
                    type="number"
                    min={1}
                    value={selectedPriority}
                    onChange={(e) => setSelectedPriority(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Priorità bassa = camera preferita per questa tipologia
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignOpen(false)}>Annulla</Button>
            {availableToAssign.length > 0 && (
              <Button onClick={handleAssign} disabled={!selectedTypeId || isPending}>
                {isPending ? "Salvataggio..." : "Assegna"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
