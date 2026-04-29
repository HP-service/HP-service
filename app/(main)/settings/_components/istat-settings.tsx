"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Separator } from "@ui/separator"
import { Badge } from "@ui/badge"
import { Switch } from "@ui/switch"
import { CheckCircle2, Loader2, XCircle, Wifi, AlertTriangle } from "lucide-react"
import { saveIstatSettings, testIstatConnection } from "@db/queries/istat"

const istatSettingsSchema = z.object({
  istat_cusr: z.string().min(1, "CUSR obbligatorio"),
  istat_apikey: z.string().min(1, "API Key obbligatoria"),
  istat_sandbox: z.boolean(),
})

type FormValues = z.infer<typeof istatSettingsSchema>

type Props = {
  propertyId: string
  currentSettings: {
    istat_cusr?: string
    istat_apikey?: string
    istat_sandbox?: boolean
  }
}

export function IstatSettings({ propertyId, currentSettings }: Props) {
  const [isPending, startTransition] = useTransition()
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(istatSettingsSchema),
    defaultValues: {
      istat_cusr: currentSettings.istat_cusr ?? "",
      istat_apikey: currentSettings.istat_apikey ?? "",
      istat_sandbox: currentSettings.istat_sandbox !== false, // default sandbox
    },
  })

  const hasCredentials = !!(currentSettings.istat_cusr && currentSettings.istat_apikey)
  const isSandbox = form.watch("istat_sandbox")

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await saveIstatSettings(propertyId, values)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Credenziali ISTAT salvate")
        setTestResult(null)
      }
    })
  }

  async function handleTest() {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await testIstatConnection()
      if (result.error) {
        setTestResult({ ok: false, message: result.error })
        toast.error("Test fallito")
      } else {
        setTestResult({ ok: true, message: result.data?.message || "Connessione riuscita" })
        toast.success("Connessione riuscita!")
      }
    } catch {
      setTestResult({ ok: false, message: "Errore imprevisto durante il test" })
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Stato connessione */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Stato:</span>
        {hasCredentials ? (
          <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
            <CheckCircle2 className="mr-1 h-3 w-3" /> Configurato
          </Badge>
        ) : (
          <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
            <XCircle className="mr-1 h-3 w-3" /> Non configurato
          </Badge>
        )}
        {hasCredentials && (
          <Badge variant="outline" className={isSandbox ? "text-blue-700 border-blue-300 bg-blue-50" : "text-orange-700 border-orange-300 bg-orange-50"}>
            {isSandbox ? "Sandbox" : "Produzione"}
          </Badge>
        )}
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Credenziali ISTAT Movimentazione</h3>
          <p className="text-xs text-muted-foreground">
            Inserisci le credenziali per la trasmissione della movimentazione turistica
            alla Regione Campania tramite API REST.
          </p>

          <div className="space-y-1.5">
            <Label>CUSR (Codice Utente Struttura Ricettiva) *</Label>
            <Input
              {...form.register("istat_cusr")}
              placeholder="Codice CUSR fornito dalla Regione"
              autoComplete="off"
            />
            {form.formState.errors.istat_cusr && (
              <p className="text-xs text-destructive">
                {form.formState.errors.istat_cusr.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>API Key *</Label>
            <Input
              type="password"
              {...form.register("istat_apikey")}
              placeholder="API Key"
              autoComplete="off"
            />
            {form.formState.errors.istat_apikey && (
              <p className="text-xs text-destructive">
                {form.formState.errors.istat_apikey.message}
              </p>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Ambiente</Label>
              <p className="text-xs text-muted-foreground">
                {isSandbox
                  ? "Sandbox (collaudo) — i dati NON vengono inviati ufficialmente"
                  : "Produzione — i dati vengono inviati ufficialmente alla Regione"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {isSandbox ? "Sandbox" : "Produzione"}
              </span>
              <Switch
                checked={!isSandbox}
                onCheckedChange={(checked) => form.setValue("istat_sandbox", !checked)}
              />
            </div>
          </div>

          {!isSandbox && (
            <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" />
              <p className="text-xs text-orange-800">
                <strong>Attenzione:</strong> In modalita produzione i dati vengono inviati
                ufficialmente alla Regione Campania. Assicurati che le informazioni siano corrette.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="submit" disabled={isPending}>
            {isPending ? "Salvataggio..." : "Salva credenziali"}
          </Button>
        </div>
      </form>

      <Separator />

      {/* Test connessione */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Test connessione</h3>
        <p className="text-xs text-muted-foreground">
          Verifica che le credenziali salvate siano valide effettuando un login di prova
          e scaricando i codici ISTAT dal portale regionale.
        </p>

        <Button
          variant="outline"
          onClick={handleTest}
          disabled={isTesting || !hasCredentials}
        >
          {isTesting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Wifi className="mr-2 h-4 w-4" />
          )}
          {isTesting ? "Test in corso..." : "Testa connessione"}
        </Button>

        {!hasCredentials && (
          <p className="text-xs text-muted-foreground">
            Salva le credenziali prima di effettuare il test
          </p>
        )}

        {testResult && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              testResult.ok
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <div className="flex items-start gap-2">
              {testResult.ok ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              )}
              <span>{testResult.message}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
