"use client"

import { useState, useTransition } from "react"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Badge } from "@ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@ui/dialog"
import {
  Copy,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  Globe,
} from "lucide-react"
import { toast } from "sonner"
import {
  getIcalToken,
  regenerateIcalToken,
  createIcalSubscription,
  deleteIcalSubscription,
  syncIcalSubscription,
} from "@db/queries/ical"

type Room = { id: string; name: string }
type Channel = { id: string; name: string }
type Subscription = {
  id: string
  room_id: string
  channel_id: string | null
  ical_url: string
  last_synced_at: string | null
  sync_status: string
  last_error: string | null
  is_active: boolean
  room: { name: string } | null
  channel: { name: string } | null
}

export function IcalSettings({
  propertyId,
  rooms,
  channels,
  subscriptions: initialSubs,
  icalToken: initialToken,
}: {
  propertyId: string
  rooms: Room[]
  channels: Channel[]
  subscriptions: Subscription[]
  icalToken: string
}) {
  const [token, setToken] = useState(initialToken)
  const [subs, setSubs] = useState(initialSubs)
  const [isPending, startTransition] = useTransition()

  // ── Export URLs ──────────────────────────────────
  const baseUrl = typeof window !== "undefined" ? window.location.origin : ""

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url)
    toast.success("URL copiato!")
  }

  function handleRegenerateToken() {
    startTransition(async () => {
      const result = await regenerateIcalToken()
      if (result.error) {
        toast.error(result.error)
      } else {
        setToken(result.data!)
        toast.success("Token rigenerato. Aggiorna gli URL nelle OTA.")
      }
    })
  }

  // ── Import ──────────────────────────────────
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newRoomId, setNewRoomId] = useState("")
  const [newChannelId, setNewChannelId] = useState("")
  const [newUrl, setNewUrl] = useState("")

  function handleAddSubscription() {
    if (!newRoomId || !newUrl) {
      toast.error("Camera e URL sono obbligatori")
      return
    }
    startTransition(async () => {
      const result = await createIcalSubscription({
        room_id: newRoomId,
        channel_id: newChannelId || null,
        ical_url: newUrl,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Sottoscrizione aggiunta")
        setDialogOpen(false)
        setNewRoomId("")
        setNewChannelId("")
        setNewUrl("")
        // Refresh
        window.location.reload()
      }
    })
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteIcalSubscription(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        setSubs((prev) => prev.filter((s) => s.id !== id))
        toast.success("Sottoscrizione rimossa")
      }
    })
  }

  function handleSync(id: string) {
    startTransition(async () => {
      const result = await syncIcalSubscription(id)
      if (result.error) {
        toast.error(`Errore sync: ${result.error}`)
      } else {
        const d = result.data!
        toast.success(`Sync completata: ${d.created} create, ${d.updated} aggiornate, ${d.cancelled} cancellate`)
        window.location.reload()
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* ── EXPORT ────────────────────────────── */}
      <section>
        <h3 className="text-base font-semibold mb-1">Export iCal (il tuo calendario)</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Copia questi URL e incollali nelle impostazioni delle OTA (Booking.com, Airbnb, ecc.)
          per sincronizzare la disponibilità delle camere.
        </p>

        <div className="space-y-3">
          {/* Global URL */}
          <div className="flex items-center gap-2 rounded-lg border p-3 bg-muted/30">
            <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Tutte le camere</p>
              <p className="text-xs font-mono truncate">
                {baseUrl}/api/ical/all?propertyId={propertyId}&token={token}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => copyUrl(`${baseUrl}/api/ical/all?propertyId=${propertyId}&token=${token}`)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          {/* Per-room URLs */}
          {rooms.map((room) => (
            <div key={room.id} className="flex items-center gap-2 rounded-lg border p-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium">{room.name}</p>
                <p className="text-xs font-mono truncate text-muted-foreground">
                  {baseUrl}/api/ical/{room.id}?token={token}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyUrl(`${baseUrl}/api/ical/${room.id}?token=${token}`)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRegenerateToken} disabled={isPending}>
            <RefreshCw className="mr-1 h-3 w-3" />
            Rigenera token
          </Button>
          <p className="text-xs text-muted-foreground">
            Rigenerando il token, dovrai aggiornare gli URL su tutte le OTA.
          </p>
        </div>
      </section>

      {/* ── IMPORT ────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">Import iCal (dalle OTA)</h3>
            <p className="text-sm text-muted-foreground">
              Incolla gli URL iCal forniti dalle OTA per importare automaticamente le prenotazioni.
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Aggiungi
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuova sottoscrizione iCal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Camera</Label>
                  <Select value={newRoomId} onValueChange={setNewRoomId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona camera" />
                    </SelectTrigger>
                    <SelectContent>
                      {rooms.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Canale OTA</Label>
                  <Select value={newChannelId} onValueChange={setNewChannelId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona canale (opzionale)" />
                    </SelectTrigger>
                    <SelectContent>
                      {channels.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>URL iCal</Label>
                  <Input
                    placeholder="https://www.airbnb.com/calendar/ical/..."
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Lo trovi nelle impostazioni del calendario della OTA.
                  </p>
                </div>

                <Button onClick={handleAddSubscription} disabled={isPending} className="w-full">
                  {isPending ? "Salvataggio..." : "Salva"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {subs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Nessuna sottoscrizione iCal configurata. Aggiungi gli URL delle OTA per iniziare.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Camera</TableHead>
                <TableHead>Canale</TableHead>
                <TableHead>Stato</TableHead>
                <TableHead>Ultima sync</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subs.map((sub) => (
                <TableRow key={sub.id}>
                  <TableCell className="font-medium">
                    {(sub.room as { name: string } | null)?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {(sub.channel as { name: string } | null)?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    {sub.sync_status === "ok" ? (
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> OK
                      </Badge>
                    ) : sub.sync_status === "error" ? (
                      <Badge variant="outline" className="text-red-700 border-red-300 bg-red-50" title={sub.last_error ?? ""}>
                        <XCircle className="mr-1 h-3 w-3" /> Errore
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50">
                        <Clock className="mr-1 h-3 w-3" /> In attesa
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {sub.last_synced_at
                      ? new Date(sub.last_synced_at).toLocaleString("it-IT", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Mai"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSync(sub.id)}
                        disabled={isPending}
                        title="Sincronizza ora"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => window.open(sub.ical_url, "_blank")}
                        title="Apri URL"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(sub.id)}
                        disabled={isPending}
                        title="Rimuovi"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
