export const dynamic = "force-dynamic"

import { Suspense } from "react"
import { IstatPageClient } from "./_components/istat-page-client"
import { getIstatHistory } from "@db/queries/istat"

export default async function IstatPage() {
  const historyResult = await getIstatHistory()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">ISTAT Movimentazione</h1>
        <p className="text-muted-foreground">
          Trasmissione dati turistici alla Regione Campania
        </p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Caricamento...</div>}>
        <IstatPageClient
          initialHistory={historyResult.data ?? []}
        />
      </Suspense>
    </div>
  )
}
