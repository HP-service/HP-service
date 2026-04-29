"use client"

import { useState, useTransition } from "react"
import { format, startOfMonth, endOfMonth, subDays, addDays } from "date-fns"
import { it } from "date-fns/locale"
import { toast } from "sonner"
import { Button } from "@ui/button"
import { Badge } from "@ui/badge"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Separator } from "@ui/separator"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ui/table"
import {
  CalendarDays,
  Send,
  Eye,
  Loader2,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  AlertTriangle,
  FileBarChart,
} from "lucide-react"
import { buildMovimentazionePreview, sendMovimentazione, getIstatHistory } from "@db/queries/istat"
import type { Giornata, Movimentazione } from "@istat/types"

type HistoryEntry = {
  data_rilevazione: string
  camere_occupate: number
  giornate: unknown
  response_status: number | null
  submitted_at: string
}

type Props = {
  initialHistory: HistoryEntry[]
}

export function IstatPageClient({ initialHistory }: Props) {
  const today = new Date()
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(today), "yyyy-MM-dd"))
  const [dateTo, setDateTo] = useState(format(today, "yyyy-MM-dd"))
  const [preview, setPreview] = useState<Giornata[] | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>(initialHistory)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [isPreviewing, startPreview] = useTransition()
  const [isSending, startSend] = useTransition()

  // Quick period selectors
  function setYesterday() {
    const ieri = format(subDays(today, 1), "yyyy-MM-dd")
    setDateFrom(ieri)
    setDateTo(ieri)
    setPreview(null)
  }

  function setThisMonth() {
    setDateFrom(format(startOfMonth(today), "yyyy-MM-dd"))
    setDateTo(format(today, "yyyy-MM-dd"))
    setPreview(null)
  }

  function setLastMonth() {
    const lastMonth = subDays(startOfMonth(today), 1)
    setDateFrom(format(startOfMonth(lastMonth), "yyyy-MM-dd"))
    setDateTo(format(endOfMonth(lastMonth), "yyyy-MM-dd"))
    setPreview(null)
  }

  // Preview
  function handlePreview() {
    startPreview(async () => {
      const result = await buildMovimentazionePreview(dateFrom, dateTo)
      if (result.error) {
        toast.error(result.error)
        setPreview(null)
      } else {
        setPreview(result.data ?? [])
        if ((result.data ?? []).length === 0) {
          toast.info("Nessuna movimentazione nel periodo selezionato")
        }
      }
    })
  }

  // Send
  function handleSend() {
    if (!preview || preview.length === 0) return

    startSend(async () => {
      const result = await sendMovimentazione(dateFrom, dateTo)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Inviate ${result.data?.giornateInviate ?? 0} giornate con successo!`)
        setPreview(null)
        // Refresh history
        const historyResult = await getIstatHistory()
        if (historyResult.data) setHistory(historyResult.data)
      }
    })
  }

  // Toggle row expand
  function toggleRow(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Format DDMMYYYY → readable date
  function formatIstatDate(ddmmyyyy: string): string {
    if (ddmmyyyy.length !== 8) return ddmmyyyy
    const dd = ddmmyyyy.slice(0, 2)
    const mm = ddmmyyyy.slice(2, 4)
    const yyyy = ddmmyyyy.slice(4, 8)
    try {
      return format(new Date(Number(yyyy), Number(mm) - 1, Number(dd)), "EEE dd MMM", { locale: it })
    } catch {
      return `${dd}/${mm}/${yyyy}`
    }
  }

  // Totals for a giornata
  function getTotals(g: Giornata) {
    return g.movimentazioni.reduce(
      (acc, m) => ({
        arrivi: acc.arrivi + m.arrivi,
        presenze: acc.presenze + m.presentiNottePrecedente,
        partenze: acc.partenze + m.partenze,
      }),
      { arrivi: 0, presenze: 0, partenze: 0 }
    )
  }

  // Check if date already sent
  function isDateSent(istatDate: string): boolean {
    if (istatDate.length !== 8) return false
    const dd = istatDate.slice(0, 2)
    const mm = istatDate.slice(2, 4)
    const yyyy = istatDate.slice(4, 8)
    const dbDate = `${yyyy}-${mm}-${dd}`
    return history.some((h) => h.data_rilevazione === dbDate)
  }

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Periodo</h2>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label>Da</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPreview(null) }}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5">
            <Label>A</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPreview(null) }}
              className="w-40"
            />
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={setYesterday}>Ieri</Button>
            <Button variant="outline" size="sm" onClick={setThisMonth}>Mese corrente</Button>
            <Button variant="outline" size="sm" onClick={setLastMonth}>Mese precedente</Button>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Button onClick={handlePreview} disabled={isPreviewing || !dateFrom || !dateTo}>
            {isPreviewing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            {isPreviewing ? "Calcolo..." : "Calcola anteprima"}
          </Button>

          {preview && preview.length > 0 && (
            <Button onClick={handleSend} disabled={isSending} variant="default">
              {isSending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              {isSending ? "Invio in corso..." : `Invia ${preview.length} giornate`}
            </Button>
          )}
        </div>
      </div>

      {/* Preview table */}
      {preview && (
        <div className="rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Anteprima Movimentazione</h2>
            </div>
            <Badge variant="outline">
              {preview.length} giornate
            </Badge>
          </div>

          {preview.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nessuna movimentazione nel periodo selezionato. Non ci sono arrivi, presenze o partenze.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Camere</TableHead>
                  <TableHead className="text-right">Arrivi</TableHead>
                  <TableHead className="text-right">Presenze</TableHead>
                  <TableHead className="text-right">Partenze</TableHead>
                  <TableHead className="text-center">Stato</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.map((g) => {
                  const totals = getTotals(g)
                  const sent = isDateSent(g.dataRilevazione)
                  const key = g.dataRilevazione
                  const isExpanded = expandedRows.has(key)

                  return (
                    <>
                      <TableRow
                        key={key}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(key)}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatIstatDate(g.dataRilevazione)}
                        </TableCell>
                        <TableCell className="text-right">{g.camereOccupate}</TableCell>
                        <TableCell className="text-right">{totals.arrivi}</TableCell>
                        <TableCell className="text-right">{totals.presenze}</TableCell>
                        <TableCell className="text-right">{totals.partenze}</TableCell>
                        <TableCell className="text-center">
                          {sent ? (
                            <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Inviato
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                              <Clock className="mr-1 h-3 w-3" /> Da inviare
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${key}-detail`} className="bg-muted/30">
                          <TableCell colSpan={7} className="p-0">
                            <MovimentazioniDetail movimentazioni={g.movimentazioni} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* History */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Storico Invii</h2>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nessun invio effettuato
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data Rilevazione</TableHead>
                <TableHead className="text-right">Camere</TableHead>
                <TableHead className="text-center">Stato HTTP</TableHead>
                <TableHead>Inviato il</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.map((h) => (
                <TableRow key={h.data_rilevazione}>
                  <TableCell className="font-medium">
                    {(() => {
                      try {
                        return format(new Date(h.data_rilevazione), "EEE dd MMM yyyy", { locale: it })
                      } catch {
                        return h.data_rilevazione
                      }
                    })()}
                  </TableCell>
                  <TableCell className="text-right">{h.camere_occupate}</TableCell>
                  <TableCell className="text-center">
                    {h.response_status === 201 ? (
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                        201 OK
                      </Badge>
                    ) : h.response_status ? (
                      <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50">
                        <AlertTriangle className="mr-1 h-3 w-3" /> {h.response_status}
                      </Badge>
                    ) : (
                      <Badge variant="outline">N/A</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(() => {
                      try {
                        return format(new Date(h.submitted_at), "dd/MM/yyyy HH:mm", { locale: it })
                      } catch {
                        return h.submitted_at
                      }
                    })()}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}

// ── Sub-component: nationality/province breakdown ──

function MovimentazioniDetail({ movimentazioni }: { movimentazioni: Movimentazione[] }) {
  if (movimentazioni.length === 0) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        Nessuna movimentazione
      </div>
    )
  }

  return (
    <div className="p-4">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-muted-foreground text-xs">
            <th className="text-left pb-2">Provenienza</th>
            <th className="text-right pb-2">Arrivi</th>
            <th className="text-right pb-2">Presenze</th>
            <th className="text-right pb-2">Partenze</th>
          </tr>
        </thead>
        <tbody>
          {movimentazioni.map((m, i) => (
            <tr key={i} className="border-t border-muted">
              <td className="py-1.5">
                {m.codiceProvincia ? (
                  <span className="text-xs">
                    <Badge variant="outline" className="text-xs mr-1">IT</Badge>
                    Provincia {m.codiceProvincia}
                  </span>
                ) : (
                  <span className="text-xs">
                    <Badge variant="outline" className="text-xs mr-1">EST</Badge>
                    Nazione {m.codiceNazione}
                  </span>
                )}
              </td>
              <td className="text-right py-1.5">{m.arrivi}</td>
              <td className="text-right py-1.5">{m.presentiNottePrecedente}</td>
              <td className="text-right py-1.5">{m.partenze}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
