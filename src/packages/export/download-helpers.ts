"use client"

/**
 * Helper per generare e scaricare file XLS e PDF lato client.
 * Usa le librerie xlsx e jspdf + jspdf-autotable.
 */

import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

// ─── Tipi ──────────────────────────────────────────────────────────────────────

export type ExportColumn = {
  header: string
  key: string
  width?: number // larghezza colonna PDF in mm
}

export type ExportData = Record<string, string | number | boolean | null | undefined>[]

// ─── XLS Export ────────────────────────────────────────────────────────────────

export function downloadXLS(
  data: ExportData,
  columns: ExportColumn[],
  filename: string,
  sheetName = "Dati"
) {
  // Mappa i dati alle colonne con header italiani
  const rows = data.map((row) => {
    const obj: Record<string, unknown> = {}
    for (const col of columns) {
      obj[col.header] = row[col.key] ?? ""
    }
    return obj
  })

  const ws = XLSX.utils.json_to_sheet(rows)

  // Imposta larghezze colonne
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? 18 }))

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

// ─── PDF Export ────────────────────────────────────────────────────────────────

export function downloadPDF(
  data: ExportData,
  columns: ExportColumn[],
  filename: string,
  title?: string
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })

  // Header
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.text(title ?? filename, 14, 18)

  // Data e ora
  doc.setFontSize(9)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(120, 120, 120)
  const now = new Date()
  doc.text(
    `Generato il ${now.toLocaleDateString("it-IT")} alle ${now.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`,
    14,
    25
  )
  doc.setTextColor(0, 0, 0)

  // Tabella
  const headers = columns.map((c) => c.header)
  const body = data.map((row) =>
    columns.map((c) => {
      const val = row[c.key]
      return val !== null && val !== undefined ? String(val) : ""
    })
  )

  autoTable(doc, {
    head: [headers],
    body,
    startY: 30,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [37, 99, 235], // blue-600
      textColor: 255,
      fontStyle: "bold",
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [245, 247, 250],
    },
    margin: { left: 14, right: 14 },
  })

  // Footer
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `Pagina ${i} di ${pageCount}`,
      doc.internal.pageSize.getWidth() - 30,
      doc.internal.pageSize.getHeight() - 8
    )
  }

  doc.save(`${filename}.pdf`)
}
