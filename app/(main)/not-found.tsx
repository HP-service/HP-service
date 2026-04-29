import Link from "next/link"
import { Button } from "@ui/button"
import { SearchX } from "lucide-react"

export default function MainNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
        <SearchX className="h-7 w-7 text-muted-foreground/50" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Pagina non trovata</h2>
        <p className="text-sm text-muted-foreground">
          La risorsa che stai cercando non esiste o è stata eliminata.
        </p>
      </div>
      <Button asChild variant="outline">
        <Link href="/dashboard">Torna alla dashboard</Link>
      </Button>
    </div>
  )
}
