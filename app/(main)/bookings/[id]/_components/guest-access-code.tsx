"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { KeyRound, RefreshCw, Copy, Check } from "lucide-react"
import { Button } from "@ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { regenerateGuestCode } from "@db/queries/guest-portal"

type Props = {
  bookingId: string
  accessCode: string | null
  roomName: string | null | undefined
}

export function GuestAccessCodeCard({ bookingId, accessCode, roomName }: Props) {
  const [code, setCode] = useState(accessCode)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleRegenerate() {
    startTransition(async () => {
      const result = await regenerateGuestCode(bookingId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setCode(result.data)
        toast.success("Nuovo codice generato")
      }
    })
  }

  function handleCopy() {
    if (!code) return
    const text = roomName ? `Camera: ${roomName}\nCodice: ${code}` : code
    navigator.clipboard.writeText(text)
    setCopied(true)
    toast.success("Copiato!")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 text-blue-600" />
          Portale Ospite
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {code ? (
          <>
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-white px-4 py-2 border border-blue-200">
                <span className="font-mono text-2xl font-bold tracking-[0.3em] text-blue-700">
                  {code}
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              L'ospite accede a <span className="font-mono">/guest</span> con il numero camera e questo codice
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Nessun codice generato. Il codice si genera automaticamente al check-in.
          </p>
        )}
        <Button variant="outline" size="sm" onClick={handleRegenerate} disabled={isPending}>
          <RefreshCw className={`mr-2 h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
          {code ? "Rigenera Codice" : "Genera Codice"}
        </Button>
      </CardContent>
    </Card>
  )
}
