"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Pencil } from "lucide-react"
import { Button } from "@ui/button"
import { Badge } from "@ui/badge"
import { Avatar, AvatarFallback } from "@ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@ui/dialog"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Switch } from "@ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { createStaffUser, updateStaffUser } from "@db/queries/staff"
import { staffSchema } from "@db/schema"

type Profile = {
  id: string
  full_name: string
  email: string
  role: string
  is_active: boolean
}

type Props = {
  propertyId: string
  staff: Profile[]
}

type NewUserValues = z.infer<typeof staffSchema>

const ROLES = ["Manager", "Reception", "Housekeeping", "Maintenance"] as const

const ROLE_LABELS: Record<string, string> = {
  Manager: "Manager",
  Reception: "Reception",
  Housekeeping: "Housekeeping",
  Maintenance: "Manutenzione",
}

export function StaffManager({ propertyId, staff }: Props) {
  const [open, setOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [isPending, startTransition] = useTransition()

  const newForm = useForm<NewUserValues>({
    resolver: zodResolver(staffSchema),
    defaultValues: { full_name: "", email: "", role: "Reception", password: "" },
  })

  const editForm = useForm<{ role: string; is_active: boolean }>({
    defaultValues: { role: "Reception", is_active: true },
  })

  function openCreate() {
    setEditingProfile(null)
    newForm.reset()
    setOpen(true)
  }

  function openEdit(p: Profile) {
    setEditingProfile(p)
    editForm.reset({ role: p.role, is_active: p.is_active })
    setOpen(true)
  }

  function onSubmitNew(values: NewUserValues) {
    startTransition(async () => {
      const result = await createStaffUser(propertyId, values)
      if (result.error) toast.error(result.error)
      else {
        toast.success("Utente creato")
        setOpen(false)
      }
    })
  }

  function onSubmitEdit(values: { role: string; is_active: boolean }) {
    if (!editingProfile) return
    startTransition(async () => {
      const result = await updateStaffUser(editingProfile.id, values)
      if (result.error) toast.error(result.error)
      else {
        toast.success("Utente aggiornato")
        setOpen(false)
      }
    })
  }

  function initials(name: string) {
    return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{staff.length} utenti</p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1 h-4 w-4" />
          Nuovo Utente
        </Button>
      </div>

      <div className="rounded-lg border divide-y">
        {staff.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Nessun utente configurato.
          </div>
        ) : (
          staff.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs">{initials(p.full_name)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{p.full_name}</p>
                <p className="text-xs text-muted-foreground">{p.email}</p>
              </div>
              <Badge variant="outline">{ROLE_LABELS[p.role] ?? p.role}</Badge>
              <Badge variant={p.is_active ? "default" : "secondary"}>
                {p.is_active ? "Attivo" : "Disabilitato"}
              </Badge>
              <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingProfile ? "Modifica Utente" : "Nuovo Utente"}</DialogTitle>
          </DialogHeader>

          {editingProfile ? (
            <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Ruolo</Label>
                <Select
                  value={editForm.watch("role")}
                  onValueChange={(v) => editForm.setValue("role", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Utente attivo</Label>
                <Switch
                  checked={editForm.watch("is_active")}
                  onCheckedChange={(v) => editForm.setValue("is_active", v)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Disabilitare un utente impedisce l&apos;accesso senza eliminarlo.
              </p>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Salvataggio..." : "Aggiorna"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <form onSubmit={newForm.handleSubmit(onSubmitNew)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nome completo *</Label>
                <Input {...newForm.register("full_name")} placeholder="Mario Rossi" />
                {newForm.formState.errors.full_name && (
                  <p className="text-xs text-destructive">{newForm.formState.errors.full_name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input type="email" {...newForm.register("email")} placeholder="mario@hotel.com" />
                {newForm.formState.errors.email && (
                  <p className="text-xs text-destructive">{newForm.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Password temporanea *</Label>
                <Input type="password" {...newForm.register("password")} placeholder="Min. 6 caratteri" />
                {newForm.formState.errors.password && (
                  <p className="text-xs text-destructive">{newForm.formState.errors.password.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Ruolo *</Label>
                <Select
                  value={newForm.watch("role")}
                  onValueChange={(v) => newForm.setValue("role", v as never)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Creazione..." : "Crea Utente"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
