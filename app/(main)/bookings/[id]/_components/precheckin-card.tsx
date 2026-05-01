"use client"

import { useState, useTransition } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Button } from "@ui/button"
import { ClipboardCheck, Link2, Copy, Check, Loader2, ExternalLink } from "lucide-react"

export function PreCheckinCard({
  bookingId,
  bookingNumber,
  hasToken,
  existingToken,
}: {
  bookingId: string
  bookingNumber: string
  hasToken: boolean
  existingToken?: string | null
}) {
  const [token, setToken] = useState<string | null>(existingToken ?? null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const link = token
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/pre-checkin/${token}`
    : null

  async function generateToken() {
    setError(null)
    startTransition(async () => {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc("generate_precheckin_token", {
        p_booking_id: bookingId,
      })
      if (rpcError || !data) {
        setError(rpcError?.message ?? "Errore nella generazione del link.")
        return
      }
      setToken(data as string)
    })
  }

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
      const el = document.createElement("textarea")
      el.value = link
      document.body.appendChild(el)
      el.select()
      document.execCommand("copy")
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardCheck className="h-4 w-4 text-indigo-600" />
          Pre Check-in Digitale
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Invia all'ospite il link di pre check-in per raccogliere i dati del documento prima
          dell'arrivo.
        </p>

        {!token ? (
          <Button
            size="sm"
            onClick={generateToken}
            disabled={isPending}
            className="w-full gap-2"
          >
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
            Genera link pre check-in
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2">
              <span className="flex-1 truncate font-mono text-[11px] text-indigo-700">{link}</span>
              <button
                onClick={copyLink}
                title="Copia link"
                className="shrink-0 rounded-lg p-1 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 text-xs"
                onClick={copyLink}
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span className="text-emerald-600">Copiato!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    Copia link
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5 text-xs"
                asChild
              >
                <a href={link!} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3 w-3" />
                  Anteprima
                </a>
              </Button>
            </div>
          </div>
        )}

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
