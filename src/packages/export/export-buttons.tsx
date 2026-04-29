"use client"

import { useState } from "react"
import { Button } from "@ui/button"
import { Download, FileSpreadsheet, FileText, ChevronDown } from "lucide-react"
import { downloadXLS, downloadPDF, type ExportColumn, type ExportData } from "./download-helpers"

type Props = {
  data: ExportData
  columns: ExportColumn[]
  filename: string
  title?: string
  sheetName?: string
}

export function ExportButtons({ data, columns, filename, title, sheetName }: Props) {
  const [open, setOpen] = useState(false)

  if (!data || data.length === 0) return null

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="h-8 text-xs gap-1.5"
        onClick={() => setOpen(!open)}
      >
        <Download className="h-3.5 w-3.5" />
        Esporta
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <>
          {/* Overlay per chiudere */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-card border rounded-lg shadow-lg p-1 min-w-[160px]">
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors"
              onClick={() => {
                downloadXLS(data, columns, filename, sheetName)
                setOpen(false)
              }}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              <div className="text-left">
                <div className="font-medium">Excel (.xlsx)</div>
                <div className="text-[10px] text-muted-foreground">Foglio di calcolo</div>
              </div>
            </button>
            <button
              className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-muted rounded-md transition-colors"
              onClick={() => {
                downloadPDF(data, columns, filename, title)
                setOpen(false)
              }}
            >
              <FileText className="h-4 w-4 text-red-500" />
              <div className="text-left">
                <div className="font-medium">PDF (.pdf)</div>
                <div className="text-[10px] text-muted-foreground">Per stampa / backup</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
