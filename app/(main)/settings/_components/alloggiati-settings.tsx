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
import { CheckCircle2, Loader2, XCircle, Wifi } from "lucide-react"
import { saveAlloggiatiSettings, testAlloggiatiConnection } from "@db/queries/checkin"
import { alloggiatiSettingsSchema } from "@db/schema"

type FormValues = z.infer<typeof alloggiatiSettingsSchema>

type Props = {
  propertyId: string
  currentSettings: {
    alloggiati_username?: string
    alloggiati_password?: string
    alloggiati_wskey?: string
  }
}

export function AlloggiatiSettings({ propertyId, currentSettings }: Props) {
  const [isPending, startTransition] = useTransition()
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [isTesting, setIsTesting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(alloggiatiSettingsSchema),
    defaultValues: {
      alloggiati_username: currentSettings.alloggiati_username ?? "",
      alloggiati_password: currentSettings.alloggiati_password ?? "",
      alloggiati_wskey: currentSettings.alloggiati_wskey ?? "",
    },
  })

  const hasCredentials = !!(
    currentSettings.alloggiati_username &&
    currentSettings.alloggiati_password &&
    currentSettings.alloggiati_wskey
  )

  function onSubmit(values: FormValues) {
    startTransition(async () => {
      const result = await saveAlloggiatiSettings(propertyId, values)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Credenziali Alloggiati salvate")
        setTestResult(null) // reset test dopo salvataggio
      }
    })
  }

  async function handleTest() {
    setIsTesting(true)
    setTestResult(null)
    try {
      const result = await testAlloggiatiConnection()
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
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Credenziali Alloggiati Web</h3>
          <p className="text-xs text-muted-foreground">
            Inserisci le credenziali ricevute dalla Questura per il servizio Alloggiati Web.
            Queste credenziali sono necessarie per trasmettere le schedine degli ospiti.
          </p>

          <div className="space-y-1.5">
            <Label>Username *</Label>
            <Input
              {...form.register("alloggiati_username")}
              placeholder="Username fornito dalla Questura"
              autoComplete="off"
            />
            {form.formState.errors.alloggiati_username && (
              <p className="text-xs text-destructive">
                {form.formState.errors.alloggiati_username.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Password *</Label>
            <Input
              type="password"
              {...form.register("alloggiati_password")}
              placeholder="Password"
              autoComplete="off"
            />
            {form.formState.errors.alloggiati_password && (
              <p className="text-xs text-destructive">
                {form.formState.errors.alloggiati_password.message}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>WSKey *</Label>
            <Input
              {...form.register("alloggiati_wskey")}
              placeholder="Web Service Key"
              autoComplete="off"
            />
            {form.formState.errors.alloggiati_wskey && (
              <p className="text-xs text-destructive">
                {form.formState.errors.alloggiati_wskey.message}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Chiave WS fornita per l&apos;accesso al servizio SOAP
            </p>
          </div>
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
          Verifica che le credenziali salvate siano valide effettuando un test di autenticazione
          con il servizio Alloggiati Web della Polizia di Stato.
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
