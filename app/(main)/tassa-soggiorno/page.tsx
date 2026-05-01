export const dynamic = "force-dynamic"

import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import { getTouristTaxReport, getTouristTaxConfig } from "@db/queries/tourist-tax"
import { TaxReportClient } from "./_components/tax-report-client"
import { PaymentsHistory } from "./_components/payments-history"
import { listTaxPayments } from "./_actions"

type Props = {
  searchParams: Promise<{ month?: string }>
}

export default async function TassaSoggiornoPage({ searchParams }: Props) {
  const params = await searchParams
  await requireRole(MAIN_APP_ROLES)

  const now = new Date()
  const month = params.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

  const [reportResult, config, paymentsResult] = await Promise.all([
    getTouristTaxReport(month),
    getTouristTaxConfig(),
    listTaxPayments(),
  ])

  const currentMonthAmount = reportResult.data?.summary?.totalCollected ?? 0
  const payments = paymentsResult.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-foreground">Tassa di Soggiorno</h1>
        <p className="text-sm text-muted-foreground">
          Report mensile, versamenti F24 e istruzioni per il pagamento al Comune
        </p>
      </div>

      <TaxReportClient
        month={month}
        report={reportResult.error ? null : (reportResult.data ?? null) as Parameters<typeof TaxReportClient>[0]["report"]}
        error={reportResult.error ?? undefined}
        config={config ?? undefined}
      />

      {config?.tourist_tax_enabled && (
        <PaymentsHistory
          payments={payments}
          currentMonth={month}
          currentMonthAmount={currentMonthAmount}
        />
      )}
    </div>
  )
}
