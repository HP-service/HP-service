"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { updateGuest } from "@db/queries/guests"
import { guestSchema } from "@db/schema"

type Guest = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  nationality: string | null
  document_type: string | null
  document_number: string | null
  document_expiry: string | null
  date_of_birth: string | null
  tax_code: string | null
  address: string | null
  city: string | null
  country: string | null
  notes: string | null
}

type FormValues = z.infer<typeof guestSchema>

export function GuestEditForm({ guest }: { guest: Guest }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(guestSchema),
    defaultValues: {
      full_name: guest.full_name,
      email: guest.email ?? "",
      phone: guest.phone ?? "",
      nationality: guest.nationality ?? "",
      document_type: guest.document_type ?? "",
      document_number: guest.document_number ?? "",
      document_expiry: guest.document_expiry ?? "",
      date_of_birth: guest.date_of_birth ?? "",
      tax_code: guest.tax_code ?? "",
      address: guest.address ?? "",
      city: guest.city ?? "",
      country: guest.country ?? "",
      notes: guest.notes ?? "",
      tags: [],
    },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await updateGuest(guest.id, values)
      if (result.error) toast.error(result.error)
      else {
        toast.success("Ospite aggiornato")
        router.refresh()
      }
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Nome completo *</Label>
        <Input {...form.register("full_name")} className="h-8 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Email</Label>
          <Input type="email" {...form.register("email")} className="h-8 text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Telefono</Label>
          <Input {...form.register("phone")} className="h-8 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Nazionalità</Label>
          <Input {...form.register("nationality")} className="h-8 text-sm" placeholder="IT" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Cod. Fiscale</Label>
          <Input {...form.register("tax_code")} className="h-8 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Tipo documento</Label>
          <Input {...form.register("document_type")} className="h-8 text-sm" placeholder="Passaporto" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">N° documento</Label>
          <Input {...form.register("document_number")} className="h-8 text-sm" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Note</Label>
        <Input {...form.register("notes")} className="h-8 text-sm" />
      </div>
      <Button type="submit" size="sm" disabled={isPending} className="w-full">
        {isPending ? "Salvataggio..." : "Salva modifiche"}
      </Button>
    </form>
  )
}
