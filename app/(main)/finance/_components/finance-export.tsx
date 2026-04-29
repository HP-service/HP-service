"use client"

import { ExportButtons } from "@export/export-buttons"
import type { ExportColumn, ExportData } from "@export/download-helpers"

const COLUMNS: ExportColumn[] = [
  { header: "Data", key: "date", width: 12 },
  { header: "Ospite", key: "guest_name", width: 22 },
  { header: "N° Prenotazione", key: "booking_number", width: 16 },
  { header: "Metodo Pagamento", key: "method", width: 16 },
  { header: "Tipo", key: "type", width: 12 },
  { header: "Importo (€)", key: "amount", width: 12 },
]

export function FinanceExport({ data }: { data: ExportData }) {
  return (
    <ExportButtons
      data={data}
      columns={COLUMNS}
      filename="movimenti-finanziari"
      title="Movimenti Finanziari"
      sheetName="Movimenti"
    />
  )
}
