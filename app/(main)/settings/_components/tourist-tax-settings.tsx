"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Switch } from "@ui/switch"
import { Separator } from "@ui/separator"
import { Badge } from "@ui/badge"
import { Checkbox } from "@ui/checkbox"
import {
  CheckCircle2, XCircle, Landmark, Info, HelpCircle, Euro,
  Calendar, Baby, Home, Globe, Hash,
} from "lucide-react"
import { saveTouristTaxSettings } from "@db/queries/tourist-tax"
import { touristTaxSettingsSchema } from "@db/schema"

type FormValues = z.infer<typeof touristTaxSettingsSchema>

type Channel = {
  id: string
  name: string
}

type Props = {
  propertyId: string
  channels: Channel[]
  currentSettings: {
    tourist_tax_enabled?: boolean
    tourist_tax_rate?: number
    tourist_tax_max_nights?: number
    tourist_tax_child_exempt_age?: number
    tourist_tax_exempt_residents?: boolean
    tourist_tax_exempt_ota_channels?: string[]
    tourist_tax_municipality?: string
    tourist_tax_catastale_code?: string
  }
}

function Tip({ text }: { text: string }) {
  return (
    <span className="relative group inline-flex ml-1 cursor-help">
      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-blue-500 transition-colors" />
      <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2.5 py-1.5 text-[11px] text-white bg-gray-900 rounded-lg shadow-lg whitespace-normal z-50 max-w-[280px] leading-tight">
        {text}
      </span>
    </span>
  )
}

export function TouristTaxSettings({ propertyId, channels, currentSettings }: Props) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<FormValues>({
    resolver: zodResolver(touristTaxSettingsSchema),
    defaultValues: {
      tourist_tax_enabled: currentSettings.tourist_tax_enabled ?? false,
      tourist_tax_rate: currentSettings.tourist_tax_rate ?? 2,
      tourist_tax_max_nights: currentSettings.tourist_tax_max_nights ?? 10,
      tourist_tax_child_exempt_age: currentSettings.tourist_tax_child_exempt_age ?? 10,
      tourist_tax_exempt_residents: currentSettings.tourist_tax_exempt_residents ?? false,
      tourist_tax_exempt_ota_channels: currentSettings.tourist_tax_exempt_ota_channels ?? [],
      tourist_tax_municipality: currentSettings.tourist_tax_municipality ?? "",
      tourist_tax_catastale_code: currentSettings.tourist_tax_catastale_code ?? "",
    },
  })

  const isEnabled = form.watch("tourist_tax_enabled")
  const rate = form.watch("tourist_tax_rate")
  const maxNights = form.watch("tourist_tax_max_nights")
  const exemptChannels = form.watch("tourist_tax_exempt_ota_channels")

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await saveTouristTaxSettings(propertyId, values)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Configurazione tassa di soggiorno salvata")
      }
    })
  }

  function toggleChannel(channelId: string) {
    const current = form.getValues("tourist_tax_exempt_ota_channels")
    if (current.includes(channelId)) {
      form.setValue("tourist_tax_exempt_ota_channels", current.filter((c) => c !== channelId))
    } else {
      form.setValue("tourist_tax_exempt_ota_channels", [...current, channelId])
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Stato */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Stato:</span>
        {currentSettings.tourist_tax_enabled ? (
          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Attiva
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
            <XCircle className="mr-1 h-3 w-3" /> Non attiva
          </Badge>
        )}
        {currentSettings.tourist_tax_rate ? (
          <Badge variant="outline">
            €{currentSettings.tourist_tax_rate}/persona/notte
          </Badge>
        ) : null}
      </div>

      {/* Info box */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
        <div className="flex items-start gap-2">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-medium">Come funziona</p>
            <p>La tassa di soggiorno viene calcolata e aggiunta automaticamente al folio della prenotazione al momento del check-in. L&apos;importo appare come voce separata nel conto dell&apos;ospite.</p>
            <p>La tassa <strong>non e soggetta a IVA</strong> (è un&apos;imposta comunale). Le esenzioni vengono calcolate in base all&apos;età degli ospiti registrati al check-in.</p>
          </div>
        </div>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Abilitazione */}
        <div className="flex items-center justify-between rounded-lg border p-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <Landmark className="h-4 w-4 text-primary" />
              <Label className="text-base font-medium">Abilita tassa di soggiorno</Label>
            </div>
            <p className="text-sm text-muted-foreground">
              Calcola automaticamente la tassa al check-in e aggiungila al folio
            </p>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={(v) => form.setValue("tourist_tax_enabled", v)}
          />
        </div>

        {isEnabled && (
          <>
            {/* Tariffa */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Euro className="h-3.5 w-3.5" />
                  Tariffa per persona/notte *
                  <Tip text="L'importo in euro che ogni ospite tassabile deve pagare per ogni notte di soggiorno. Varia in base al tuo Comune e alla categoria della struttura." />
                </Label>
                <Input
                  type="number"
                  step="0.50"
                  min="0"
                  max="50"
                  {...form.register("tourist_tax_rate", { valueAsNumber: true })}
                  placeholder="es. 2.00"
                />
                {form.formState.errors.tourist_tax_rate && (
                  <p className="text-xs text-destructive">{form.formState.errors.tourist_tax_rate.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Esempio: €{rate ?? 2} × 2 ospiti × 3 notti = €{(rate ?? 2) * 2 * 3}
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Notti massime tassabili *
                  <Tip text="Molti Comuni prevedono un tetto massimo di notti su cui si paga la tassa (es. 7, 10 o 14 notti). Dopo questo limite, la tassa non si applica più." />
                </Label>
                <Input
                  type="number"
                  min="1"
                  max="365"
                  {...form.register("tourist_tax_max_nights", { valueAsNumber: true })}
                  placeholder="es. 10"
                />
                {form.formState.errors.tourist_tax_max_nights && (
                  <p className="text-xs text-destructive">{form.formState.errors.tourist_tax_max_nights.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Per soggiorni oltre {maxNights ?? 10} notti, la tassa si applica solo alle prime {maxNights ?? 10}
                </p>
              </div>
            </div>

            <Separator />

            {/* Esenzioni */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                Esenzioni
                <Tip text="Configura chi è esente dal pagamento della tassa. Le esenzioni vengono applicate automaticamente al check-in basandosi sui dati degli ospiti." />
              </h3>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Baby className="h-3.5 w-3.5" />
                  Età esenzione bambini *
                  <Tip text="I bambini sotto questa età sono esenti dalla tassa. Il valore varia per Comune: tipicamente 10, 12 o 14 anni. Verifica il regolamento del tuo Comune." />
                </Label>
                <Input
                  type="number"
                  min="0"
                  max="18"
                  {...form.register("tourist_tax_child_exempt_age", { valueAsNumber: true })}
                  placeholder="es. 10"
                />
                {form.formState.errors.tourist_tax_child_exempt_age && (
                  <p className="text-xs text-destructive">{form.formState.errors.tourist_tax_child_exempt_age.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  I bambini sotto i {form.watch("tourist_tax_child_exempt_age") ?? 10} anni non pagano la tassa
                </p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Home className="h-4 w-4" />
                    <Label>Esenta residenti del Comune</Label>
                    <Tip text="Se attivo, i residenti nel Comune della struttura sono esenti dalla tassa. Il controllo avviene confrontando la città dell'ospite con il nome del Comune." />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Gli ospiti residenti nel Comune non pagano la tassa
                  </p>
                </div>
                <Switch
                  checked={form.watch("tourist_tax_exempt_residents")}
                  onCheckedChange={(v) => form.setValue("tourist_tax_exempt_residents", v)}
                />
              </div>

              {form.watch("tourist_tax_exempt_residents") && (
                <div className="space-y-1.5 pl-4 border-l-2 border-blue-200">
                  <Label className="flex items-center gap-1">
                    Nome Comune della struttura
                    <Tip text="Inserisci il nome esatto del Comune dove si trova la struttura. Viene usato per confrontare la residenza dell'ospite." />
                  </Label>
                  <Input
                    {...form.register("tourist_tax_municipality")}
                    placeholder="es. Napoli, Roma, Sorrento..."
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  <Hash className="h-3.5 w-3.5" />
                  Codice catastale del Comune
                  <Tip text="Il codice catastale (es. I862 per Sorrento) viene usato per il modello F24 e per il link al portale TourTax del tuo Comune. Cercalo sul sito del Comune o chiedi al commercialista." />
                </Label>
                <Input
                  {...form.register("tourist_tax_catastale_code")}
                  placeholder="es. I862 (Sorrento)"
                  className="uppercase"
                  maxLength={4}
                />
                <p className="text-xs text-muted-foreground">
                  Sorrento = <strong>I862</strong> · Napoli = <strong>F839</strong> · Roma = <strong>H501</strong>
                </p>
              </div>
            </div>

            <Separator />

            {/* Esenzione canali OTA */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Canali OTA esenti
                <Tip text="Alcune piattaforme come Airbnb raccolgono la tassa di soggiorno direttamente dal turista e la versano al Comune per conto dell'host. In questi casi NON devi riscuoterla tu. Seleziona i canali che già raccolgono la tassa." />
              </h3>
              <p className="text-sm text-muted-foreground">
                Seleziona i canali di prenotazione dove la piattaforma raccoglie già la tassa di soggiorno per conto tuo
              </p>

              {channels.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nessun canale configurato. Vai in Impostazioni → Canali per aggiungerli.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {channels.map((ch) => {
                    const isExempt = exemptChannels.includes(ch.id)
                    return (
                      <label
                        key={ch.id}
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          isExempt ? "bg-amber-50 border-amber-200" : "hover:bg-muted/50"
                        }`}
                      >
                        <Checkbox
                          checked={isExempt}
                          onCheckedChange={() => toggleChannel(ch.id)}
                        />
                        <div>
                          <span className="text-sm font-medium">{ch.name}</span>
                          {isExempt && (
                            <p className="text-[10px] text-amber-600">
                              La piattaforma raccoglie la tassa
                            </p>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Riepilogo */}
            <div className="rounded-lg bg-muted/30 p-4 space-y-2">
              <h3 className="text-sm font-semibold">Riepilogo configurazione</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Tariffa:</span>
                <span className="font-medium">€{rate ?? 0} / persona / notte</span>
                <span className="text-muted-foreground">Max notti:</span>
                <span className="font-medium">{maxNights ?? 10} notti</span>
                <span className="text-muted-foreground">Bambini esenti sotto:</span>
                <span className="font-medium">{form.watch("tourist_tax_child_exempt_age") ?? 10} anni</span>
                <span className="text-muted-foreground">Canali esenti:</span>
                <span className="font-medium">
                  {exemptChannels.length > 0
                    ? channels.filter(c => exemptChannels.includes(c.id)).map(c => c.name).join(", ")
                    : "Nessuno"
                  }
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Esempio: 2 adulti + 1 bambino (8 anni) per 5 notti = 2 × {Math.min(5, maxNights ?? 10)} × €{rate ?? 0} = <strong>€{2 * Math.min(5, maxNights ?? 10) * (rate ?? 0)}</strong>
              </p>
            </div>
          </>
        )}

        <Button type="submit" disabled={isPending}>
          {isPending ? "Salvataggio..." : "Salva configurazione"}
        </Button>
      </form>
    </div>
  )
}
