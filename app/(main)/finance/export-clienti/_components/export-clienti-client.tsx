"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import { Download, FileSpreadsheet, FileText, Filter, Users } from "lucide-react"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@ui/card"
import { Badge } from "@ui/badge"
import { Switch } from "@ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { getClientiForExport, type ClienteFatturaRow } from "@db/queries/export-clienti"

const PAGAMENTO_OPTIONS = ["Pagamento completo", "Pagamento a rate", "Anticipo"]
const METODO_OPTIONS = ["Carta di credito", "Bonifico bancario", "Contanti", "PayPal", "Stripe"]

const COLUMN_ORDER: (keyof ClienteFatturaRow)[] = [
  "Codice cliente",
  "Tipo cliente",
  "Indirizzo telematico (Codice SDI o PEC)",
  "Email",
  "PEC",
  "Telefono",
  "ID Paese",
  "Partita Iva",
  "Codice fiscale",
  "Denominazione",
  "Nome",
  "Cognome",
  "Codice EORI (solo Privati)",
  "Nazione",
  "CAP",
  "Provincia",
  "Comune",
  "Indirizzo",
  "Numero civico",
  "Beneficiario",
  "Condizioni di pagamento",
  "Metodo di pagamento",
  "Banca",
]

export function ExportClientiClient() {
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<ClienteFatturaRow[] | null>(null)

  // Filtri
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [minStays, setMinStays] = useState("")
  const [onlyWithFiscalData, setOnlyWithFiscalData] = useState(false)
  const [defaultPagamento, setDefaultPagamento] = useState("Pagamento completo")
  const [defaultMetodo, setDefaultMetodo] = useState("Carta di credito")
  const [defaultBanca, setDefaultBanca] = useState("")

  function loadPreview(): Promise<ClienteFatturaRow[] | null> {
    return new Promise((resolve) => {
      startTransition(async () => {
        const result = await getClientiForExport({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          minStays: minStays ? Number(minStays) : undefined,
          onlyWithFiscalData,
          defaultPagamento,
          defaultMetodo,
          defaultBanca,
        })
        if (result.error) {
          toast.error(result.error)
          resolve(null)
          return
        }
        setPreview(result.data)
        resolve(result.data ?? [])
      })
    })
  }

  async function handlePreview() {
    const data = await loadPreview()
    if (data) toast.success(`Trovati ${data.length} clienti`)
  }

  async function handleDownloadXLSX() {
    const data = preview ?? (await loadPreview())
    if (!data || data.length === 0) {
      toast.error("Nessun cliente da esportare")
      return
    }
    // Worksheet con header originale (incluso doppio spazio in "Partita Iva   " come nel template)
    const sheetData = data.map((r) => ({
      "Codice cliente": r["Codice cliente"],
      "Tipo cliente": r["Tipo cliente"],
      "Indirizzo telematico (Codice SDI o PEC)": r["Indirizzo telematico (Codice SDI o PEC)"],
      "Email": r["Email"],
      "PEC": r["PEC"],
      "Telefono": r["Telefono"],
      "ID Paese": r["ID Paese"],
      "Partita Iva   ": r["Partita Iva"], // header con 3 spazi come da template
      "Codice fiscale": r["Codice fiscale"],
      "Denominazione": r["Denominazione"],
      "Nome": r["Nome"],
      "Cognome": r["Cognome"],
      "Codice EORI (solo Privati)": r["Codice EORI (solo Privati)"],
      "Nazione": r["Nazione"],
      "CAP": r["CAP"],
      "Provincia": r["Provincia"],
      "Comune": r["Comune"],
      "Indirizzo": r["Indirizzo"],
      "Numero civico": r["Numero civico"],
      "Beneficiario": r["Beneficiario"],
      "Condizioni di pagamento": r["Condizioni di pagamento"],
      "Metodo di pagamento": r["Metodo di pagamento"],
      "Banca": r["Banca"],
    }))

    const ws = XLSX.utils.json_to_sheet(sheetData)
    ws["!cols"] = COLUMN_ORDER.map(() => ({ wch: 22 }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "ImportAnagrafiche")

    // Sheet "Valori" (lookup) — opzionale ma replica il template
    const valoriRows: Array<Record<string, string>> = []
    valoriRows.push({ "Tipo Cliente": "Privato", CodicePaese: "", Provincia: "", CondizioniPagamento: "Pagamento completo" })
    valoriRows.push({ "Tipo Cliente": "Pubblica amministrazione", CodicePaese: "", Provincia: "", CondizioniPagamento: "Pagamento a rate" })
    valoriRows.push({ "Tipo Cliente": "", CodicePaese: "", Provincia: "", CondizioniPagamento: "Anticipo" })
    const wsValori = XLSX.utils.json_to_sheet(valoriRows)
    XLSX.utils.book_append_sheet(wb, wsValori, "Valori")

    const today = new Date().toISOString().split("T")[0]
    XLSX.writeFile(wb, `clienti-fatturazione-${today}.xlsx`)
    toast.success(`Esportati ${data.length} clienti in XLSX`)
  }

  async function handleDownloadCSV() {
    const data = preview ?? (await loadPreview())
    if (!data || data.length === 0) {
      toast.error("Nessun cliente da esportare")
      return
    }

    // CSV con separatore ; (standard italiano), encoding UTF-8 con BOM (per Excel)
    const headers = COLUMN_ORDER.map((h) => (h === "Partita Iva" ? "Partita Iva   " : h))
    const escape = (v: string) => {
      const s = String(v ?? "")
      if (s.includes(";") || s.includes('"') || s.includes("\n")) {
        return `"${s.replace(/"/g, '""')}"`
      }
      return s
    }

    const csvLines = [
      headers.map(escape).join(";"),
      ...data.map((row) => COLUMN_ORDER.map((c) => escape(row[c])).join(";")),
    ]
    const csv = "\uFEFF" + csvLines.join("\r\n") // BOM per Excel

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    const today = new Date().toISOString().split("T")[0]
    link.href = url
    link.download = `clienti-fatturazione-${today}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success(`Esportati ${data.length} clienti in CSV`)
  }

  return (
    <div className="space-y-6">
      {/* Filtri */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" />
            Filtri
          </CardTitle>
          <CardDescription>
            Seleziona i clienti da esportare. Lascia vuoti i filtri per esportare tutti.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="date-from">Check-in dal</Label>
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="date-to">Check-in al</Label>
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="min-stays">Minimo soggiorni</Label>
              <Input
                id="min-stays"
                type="number"
                min={0}
                placeholder="es. 1"
                value={minStays}
                onChange={(e) => setMinStays(e.target.value)}
              />
            </div>
            <div className="flex items-center justify-between space-y-0 rounded-md border px-3 py-2">
              <Label htmlFor="only-fiscal" className="cursor-pointer">
                Solo con dato fiscale
              </Label>
              <Switch
                id="only-fiscal"
                checked={onlyWithFiscalData}
                onCheckedChange={setOnlyWithFiscalData}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Default valori per gestionale fatture */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Valori di default</CardTitle>
          <CardDescription>
            Verranno applicati a tutti i clienti esportati. Personalizzabili nel gestionale fatture.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Condizioni di pagamento</Label>
            <Select value={defaultPagamento} onValueChange={setDefaultPagamento}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGAMENTO_OPTIONS.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Metodo di pagamento</Label>
            <Select value={defaultMetodo} onValueChange={setDefaultMetodo}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METODO_OPTIONS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="banca">Banca (opzionale)</Label>
            <Input
              id="banca"
              placeholder="es. Intesa San Paolo"
              value={defaultBanca}
              onChange={(e) => setDefaultBanca(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Azioni */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Esporta</CardTitle>
          <CardDescription>
            Genera il file da caricare nel tuo gestionale fatture (Fatture in Cloud, TeamSystem, ecc.)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePreview} disabled={isPending}>
              <Users className="h-4 w-4 mr-2" />
              Anteprima
            </Button>
            <Button onClick={handleDownloadXLSX} disabled={isPending}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Scarica XLSX
            </Button>
            <Button variant="secondary" onClick={handleDownloadCSV} disabled={isPending}>
              <FileText className="h-4 w-4 mr-2" />
              Scarica CSV
            </Button>
          </div>

          {preview !== null && (
            <div className="text-sm text-muted-foreground">
              <Badge variant="secondary" className="mr-2">
                {preview.length} clienti
              </Badge>
              pronti per essere esportati.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview tabella */}
      {preview && preview.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-4 w-4" />
              Anteprima ({Math.min(preview.length, 20)} di {preview.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="border-b">
                <tr>
                  <th className="text-left p-2 font-medium">Cliente</th>
                  <th className="text-left p-2 font-medium">Tipo</th>
                  <th className="text-left p-2 font-medium">Email</th>
                  <th className="text-left p-2 font-medium">Telefono</th>
                  <th className="text-left p-2 font-medium">Paese</th>
                  <th className="text-left p-2 font-medium">CF / P.IVA</th>
                  <th className="text-left p-2 font-medium">Comune</th>
                </tr>
              </thead>
              <tbody>
                {preview.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="p-2 font-medium">{r["Denominazione"]}</td>
                    <td className="p-2">{r["Tipo cliente"]}</td>
                    <td className="p-2 text-muted-foreground">{r["Email"] || "—"}</td>
                    <td className="p-2 text-muted-foreground">{r["Telefono"] || "—"}</td>
                    <td className="p-2">
                      <Badge variant="outline">{r["ID Paese"]}</Badge>
                    </td>
                    <td className="p-2 text-muted-foreground">
                      {r["Codice fiscale"] || r["Partita Iva"] || "—"}
                    </td>
                    <td className="p-2 text-muted-foreground">{r["Comune"] || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.length > 20 && (
              <div className="text-xs text-muted-foreground pt-2 text-center">
                ... e altri {preview.length - 20} clienti nel file scaricato
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
