"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Separator } from "@ui/separator"
import { updateProperty } from "@db/queries/settings"
import { propertySchema } from "@db/schema"

type Property = {
  id: string
  name: string
  address: string | null
  city: string | null
  country: string | null
  phone: string | null
  email: string | null
  vat_number: string | null
  fiscal_code: string | null
  check_in_time: string | null
  check_out_time: string | null
  currency: string | null
  timezone: string | null
}

type Props = {
  property: Property
}

type FormValues = z.infer<typeof propertySchema>

export function PropertySettings({ property }: Props) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(propertySchema),
    defaultValues: {
      name: property.name,
      address: property.address ?? "",
      city: property.city ?? "",
      country: property.country ?? "IT",
      phone: property.phone ?? "",
      email: property.email ?? "",
      vat_number: property.vat_number ?? "",
      fiscal_code: property.fiscal_code ?? "",
      check_in_time: property.check_in_time ?? "15:00",
      check_out_time: property.check_out_time ?? "11:00",
      currency: property.currency ?? "EUR",
      timezone: property.timezone ?? "Europe/Rome",
    },
  })

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await updateProperty(property.id, values)
      if (result.error) toast.error(result.error)
      else toast.success("Struttura aggiornata")
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-xl">
      <div className="space-y-4">
        <h3 className="text-sm font-medium">Informazioni generali</h3>
        <div className="space-y-1.5">
          <Label>Nome struttura *</Label>
          <Input {...form.register("name")} />
          {form.formState.errors.name && (
            <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Indirizzo</Label>
            <Input {...form.register("address")} placeholder="Via Roma 1" />
          </div>
          <div className="space-y-1.5">
            <Label>Città</Label>
            <Input {...form.register("city")} placeholder="Milano" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Telefono</Label>
            <Input {...form.register("phone")} placeholder="+39 02 1234567" />
          </div>
          <div className="space-y-1.5">
            <Label>Email struttura</Label>
            <Input type="email" {...form.register("email")} placeholder="info@hotel.com" />
            {form.formState.errors.email && (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            )}
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Dati fiscali</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Partita IVA</Label>
            <Input {...form.register("vat_number")} placeholder="IT12345678901" />
          </div>
          <div className="space-y-1.5">
            <Label>Codice fiscale</Label>
            <Input {...form.register("fiscal_code")} />
          </div>
        </div>
      </div>

      <Separator />

      <div className="space-y-4">
        <h3 className="text-sm font-medium">Orari e impostazioni</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Check-in</Label>
            <Input type="time" {...form.register("check_in_time")} />
          </div>
          <div className="space-y-1.5">
            <Label>Check-out</Label>
            <Input type="time" {...form.register("check_out_time")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Valuta</Label>
            <Input {...form.register("currency")} placeholder="EUR" />
          </div>
          <div className="space-y-1.5">
            <Label>Fuso orario</Label>
            <Input {...form.register("timezone")} placeholder="Europe/Rome" />
          </div>
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Salvataggio..." : "Salva modifiche"}
      </Button>
    </form>
  )
}
