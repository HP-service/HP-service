export const dynamic = "force-dynamic"

import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import { getTouristTaxReport, getTouristTaxConfig } from "@db/queries/tourist-tax"
import { TaxReportClient } from "./_components/tax-report-client"

type Props = {
  searchParams: Promise<{ month?: string }>
}

export default async function TassaSoggiornoPage({ searchParams }: Props) {
  const params = await searchParams
  await requireRole(MAIN_APP_ROLES)

  const now = new Date()
  const month = params.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [reportResult, config] = await Promise.all([
    getTouristTaxReport(month),
    getTouristTaxConfig(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground">Tassa di Soggiorno</h1>
        <p className="text-sm text-muted-foreground">
          Report mensile e istruzioni per il versamento al Comune
        </p>
      </div>

      <TaxReportClient
        month={month}
        report={reportResult.error ? null : (reportResult.data ?? null) as Parameters<typeof TaxReportClient>[0]["report"]}
        error={reportResult.error ?? undefined}
        config={config ?? undefined}
      />
    </div>
  )
}
