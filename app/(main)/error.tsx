"use client"

import { useEffect } from "react"
import { Button } from "@ui/button"
import { AlertTriangle } from "lucide-react"

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[MainError]", error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Si è verificato un errore</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          {error.message ?? "Errore imprevisto. Riprova o contatta il supporto."}
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">ID: {error.digest}</p>
        )}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.history.back()}>
          Torna indietro
        </Button>
        <Button onClick={reset}>
          Riprova
        </Button>
      </div>
    </div>
  )
}
