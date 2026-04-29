"use client"

import { useState, useTransition, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Search, Star, Globe, Users } from "lucide-react"
import { Button } from "@ui/button"
import { ExportButtons } from "@export/export-buttons"
import type { ExportColumn } from "@export/download-helpers"

const GUEST_EXPORT_COLUMNS: ExportColumn[] = [
  { header: "Nome", key: "full_name", width: 22 },
  { header: "Email", key: "email", width: 22 },
  { header: "Telefono", key: "phone", width: 14 },
  { header: "Nazionalità", key: "nationality", width: 10 },
  { header: "Soggiorni", key: "total_stays", width: 10 },
  { header: "Revenue (€)", key: "total_revenue", width: 12 },
  { header: "Loyalty", key: "loyalty_level", width: 10 },
]

import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@ui/dialog"
import { createGuest } from "@db/queries/guests"
import { guestSchema } from "@db/schema"

type Guest = {
  id: string
  full_name: string
  email: string | null
  phone: string | null
  nationality: string | null
  loyalty_level: string | null
  total_stays: number | null
  total_revenue: number | null
}

type Props = {
  guests: Guest[]
  propertyId: string
  error?: string
  initialSearch: string
}

type FormValues = z.infer<typeof guestSchema>

const LOYALTY_CONFIG: Record<string, {
  color: string
  bg: string
  gradient: string
  border: string
}> = {
  Bronze:   { color: "text-orange-700", bg: "bg-orange-100", gradient: "linear-gradient(135deg, #ea580c, #c2410c)", border: "border-orange-200" },
  Silver:   { color: "text-slate-600",  bg: "bg-slate-100",  gradient: "linear-gradient(135deg, #64748b, #475569)",  border: "border-slate-200" },
  Gold:     { color: "text-amber-700",  bg: "bg-amber-100",  gradient: "linear-gradient(135deg, #d97706, #b45309)",  border: "border-amber-200" },
  Platinum: { color: "text-indigo-700", bg: "bg-indigo-100", gradient: "linear-gradient(135deg, #4f46e5, #3730a3)", border: "border-indigo-200" },
}

const DEFAULT_GRADIENT = "linear-gradient(135deg, #64748b, #475569)"

export function GuestsClient({ guests, propertyId, error, initialSearch }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState(initialSearch)
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(guestSchema),
    defaultValues: { full_name: "", email: "", phone: "", nationality: "", notes: "", tags: [] },
  })

  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value)
      const params = new URLSearchParams()
      if (value) params.set("q", value)
      router.push(`/guests?${params.toString()}`)
    },
    [router]
  )

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await createGuest(propertyId, values)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Ospite creato")
        setOpen(false)
        form.reset()
        router.refresh()
      }
    })
  }

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>
  }

  // Loyalty summary counts
  const byTier = {
    Platinum: guests.filter((g) => g.loyalty_level === "Platinum").length,
    Gold: guests.filter((g) => g.loyalty_level === "Gold").length,
    Silver: guests.filter((g) => g.loyalty_level === "Silver").length,
    Bronze: guests.filter((g) => g.loyalty_level === "Bronze").length,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-foreground">Ospiti</h1>
          <p className="text-sm text-muted-foreground">{guests.length} ospiti registrati</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <ExportButtons
            data={guests.map((g) => ({
              full_name: g.full_name,
              email: g.email ?? "—",
              phone: g.phone ?? "—",
              nationality: g.nationality ?? "—",
              total_stays: g.total_stays ?? 0,
              total_revenue: g.total_revenue ? Number(g.total_revenue).toFixed(2) : "0",
              loyalty_level: g.loyalty_level ?? "—",
            }))}
            columns={GUEST_EXPORT_COLUMNS}
            filename="ospiti"
            title="Anagrafica Ospiti"
            sheetName="Ospiti"
          />
          <Button
            className="rounded-xl shadow-sm shadow-primary/30"
            onClick={() => { form.reset(); setOpen(true) }}
          >
            <Plus className="mr-1 h-4 w-4" />
            Nuovo ospite
          </Button>
        </div>
      </div>

      {/* Loyalty summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(Object.entries(byTier) as [string, number][]).map(([tier, count]) => {
          const lc = LOYALTY_CONFIG[tier]
          return (
            <div key={tier} className={`rounded-2xl border p-4 ${lc.bg} ${lc.border}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Star className={`h-4 w-4 ${lc.color}`} />
                <span className={`text-xs font-bold ${lc.color}`}>{tier}</span>
              </div>
              <div className={`text-2xl font-black ${lc.color}`}>{count}</div>
            </div>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          placeholder="Cerca per nome, email, telefono..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {guests.length === 0 ? (
          <div className="text-center py-14">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Users className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <p className="text-muted-foreground font-medium">
              {search ? "Nessun ospite trovato per questa ricerca." : "Nessun ospite. Crea il primo."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  {["Ospite", "Naz.", "Telefono", "Loyalty", "Soggiorni", "Revenue"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {guests.map((g) => {
                  const lc = LOYALTY_CONFIG[g.loyalty_level ?? ""] ?? null
                  const gradient = lc ? lc.gradient : DEFAULT_GRADIENT
                  const initials = g.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()

                  return (
                    <tr
                      key={g.id}
                      className="border-b border-border/40 hover:bg-muted/20 transition-colors cursor-pointer"
                      onClick={() => router.push(`/guests/${g.id}`)}
                    >
                      {/* Name + avatar */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-md flex-shrink-0"
                            style={{ background: gradient }}
                          >
                            {initials}
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground">{g.full_name}</p>
                            {g.email && <p className="text-xs text-muted-foreground">{g.email}</p>}
                          </div>
                        </div>
                      </td>

                      {/* Nationality */}
                      <td className="py-3.5 px-4">
                        {g.nationality ? (
                          <div className="flex items-center gap-1.5">
                            <Globe className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full">
                              {g.nationality}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4">
                        <span className="text-sm text-muted-foreground font-medium">{g.phone ?? "—"}</span>
                      </td>

                      {/* Loyalty */}
                      <td className="py-3.5 px-4">
                        {lc ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${lc.bg} ${lc.color}`}>
                            <Star className="h-3 w-3" />
                            {g.loyalty_level}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Stays */}
                      <td className="py-3.5 px-4">
                        <div>
                          <p className="text-sm font-semibold text-foreground">{g.total_stays ?? 0}</p>
                          <p className="text-xs text-muted-foreground">soggiorni</p>
                        </div>
                      </td>

                      {/* Revenue */}
                      <td className="py-3.5 px-4">
                        <p className="text-sm font-bold text-foreground">
                          {g.total_revenue ? `€ ${Number(g.total_revenue).toLocaleString("it-IT", { minimumFractionDigits: 0 })}` : "—"}
                        </p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Guest Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo Ospite</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input {...form.register("full_name")} placeholder="Mario Rossi" />
              {form.formState.errors.full_name && (
                <p className="text-xs text-destructive">{form.formState.errors.full_name.message}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" {...form.register("email")} placeholder="mario@email.com" />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Telefono</Label>
                <Input {...form.register("phone")} placeholder="+39 333 123456" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Nazionalità</Label>
                <Input {...form.register("nationality")} placeholder="IT" />
              </div>
              <div className="space-y-1.5">
                <Label>Codice fiscale</Label>
                <Input {...form.register("tax_code")} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Note</Label>
              <Input {...form.register("notes")} placeholder="Note opzionali" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annulla</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Creazione..." : "Crea Ospite"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
