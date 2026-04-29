export const dynamic = "force-dynamic"

import Link from "next/link"
import { ArrowLeft, FileSpreadsheet } from "lucide-react"
import { Button } from "@ui/button"
import { ExportClientiClient } from "./_components/export-clienti-client"

export default function ExportClientiPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/finance">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold tracking-tight">Export Clienti per Fatturazione</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            Esporta le anagrafiche dei tuoi ospiti nel formato standard SDI per il gestionale fatture
            (Fatture in Cloud, TeamSystem, e simili).
          </p>
        </div>
      </div>

      <div className="rounded-md border bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm">
        <p className="font-medium text-blue-900 dark:text-blue-100">Come funziona</p>
        <ol className="list-decimal list-inside mt-1 space-y-0.5 text-blue-800 dark:text-blue-200">
          <li>Filtra i clienti che ti servono (es. solo soggiorni di un mese)</li>
          <li>Scarica il file in <strong>XLSX</strong> o <strong>CSV</strong></li>
          <li>Caricalo nel tuo gestionale fatture nella sezione <em>Importa anagrafiche</em></li>
          <li>Crea le fatture in pochi click senza riscrivere i dati cliente</li>
        </ol>
      </div>

      <div className="rounded-md border bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm">
        <p className="font-medium text-amber-900 dark:text-amber-100">
          Conformità SDI 2026 — Clienti esteri
        </p>
        <ul className="list-disc list-inside mt-1 space-y-0.5 text-amber-800 dark:text-amber-200">
          <li>
            <strong>Codice Destinatario</strong>: <code>XXXXXXX</code> per esteri (UE/Extra-UE),
            <code className="ml-1">0000000</code> per privati italiani senza SDI/PEC
          </li>
          <li>
            <strong>Codice Fiscale</strong>: lasciato vuoto per stranieri (non obbligatorio per legge)
          </li>
          <li>
            <strong>CAP</strong>: <code>00000</code> per esteri (valore convenzionale Agenzia Entrate)
          </li>
          <li>
            <strong>Provincia</strong>: <code>EE</code> per esteri
          </li>
          <li>
            ⚠️ Per i clienti esteri devi consegnare anche una copia <strong>cartacea o PDF</strong>{" "}
            della fattura — il SdI non gli arriva
          </li>
        </ul>
      </div>

      <ExportClientiClient />
    </div>
  )
}
