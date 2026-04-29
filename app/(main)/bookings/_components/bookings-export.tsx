"use client"

import { ExportButtons } from "@export/export-buttons"
import type { ExportColumn, ExportData } from "@export/download-helpers"

const COLUMNS: ExportColumn[] = [
  { header: "N° Prenotazione", key: "booking_number", width: 16 },
  { header: "Ospite", key: "guest_name", width: 22 },
  { header: "Tipo Camera", key: "room_type", width: 16 },
  { header: "Camera", key: "room_name", width: 10 },
  { header: "Check-in", key: "check_in", width: 12 },
  { header: "Check-out", key: "check_out", width: 12 },
  { header: "Notti", key: "nights", width: 6 },
  { header: "Importo (€)", key: "total_amount", width: 12 },
  { header: "Stato", key: "status", width: 12 },
  { header: "Canale", key: "channel", width: 12 },
]

export function BookingsExport({ data }: { data: ExportData }) {
  return (
    <ExportButtons
      data={data}
      columns={COLUMNS}
      filename="prenotazioni"
      title="Elenco Prenotazioni"
      sheetName="Prenotazioni"
    />
  )
}
