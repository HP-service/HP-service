"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Save, Loader2 } from "lucide-react"
import { Button } from "@ui/button"
import { Badge } from "@ui/badge"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Textarea } from "@ui/textarea"
import { Switch } from "@ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@ui/select"
import { Separator } from "@ui/separator"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@ui/dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import {
  savePortalSettings,
  getPortalServices,
  createPortalService,
  updatePortalService,
  deletePortalService,
  getPortalAttractions,
  createPortalAttraction,
  updatePortalAttraction,
  deletePortalAttraction,
} from "@db/queries/portal-admin"
import { portalServiceSchema, portalAttractionSchema } from "@db/schema"
import { MODEL_OPTIONS, PROVIDER_LABELS, DEFAULT_MODELS, type AIProvider } from "@ai/chat-client"

// ── Types ──────────────────────────────────

type PortalService = {
  id: string
  name: string
  description: string | null
  category: string
  price: number | null
  image_url: string | null
  sort_order: number
  is_active: boolean
}

type PortalAttraction = {
  id: string
  name: string
  description: string | null
  category: string
  image_url: string | null
  external_url: string | null
  sort_order: number
  is_active: boolean
}

type PortalSettingsData = {
  portal_enabled?: boolean
  portal_whatsapp_number?: string
  portal_welcome_message?: string
  portal_wifi_network?: string
  portal_wifi_password?: string
  portal_hotel_info?: string
  ai_enabled?: boolean
  ai_provider?: string
  ai_api_key?: string
  ai_model?: string
  ai_schedule_start?: string
  ai_schedule_end?: string
  ai_knowledge_base?: string
  ai_personality?: string
}

type Props = {
  propertyId: string
  currentSettings: PortalSettingsData
  initialServices: PortalService[]
  initialAttractions: PortalAttraction[]
}

// ── Service Categories ──────────────────────────────────

const SERVICE_CATEGORIES = [
  { value: "tour", label: "Tour & Escursioni" },
  { value: "restaurant", label: "Ristoranti & Cucina" },
  { value: "transfer", label: "Transfer & Trasporti" },
  { value: "spa", label: "Benessere & Spa" },
  { value: "general", label: "Altro" },
]

const ATTRACTION_CATEGORIES = [
  { value: "attraction", label: "Attrazione" },
  { value: "tip", label: "Consiglio" },
  { value: "transport", label: "Trasporto" },
]

// ── Main Component ──────────────────────────────────

export function PortalSettings({ propertyId, currentSettings, initialServices, initialAttractions }: Props) {
  const [isPending, startTransition] = useTransition()

  // General settings state
  const [portalEnabled, setPortalEnabled] = useState(currentSettings.portal_enabled ?? false)
  const [whatsappNumber, setWhatsappNumber] = useState(currentSettings.portal_whatsapp_number ?? "")
  const [welcomeMessage, setWelcomeMessage] = useState(currentSettings.portal_welcome_message ?? "")
  const [wifiNetwork, setWifiNetwork] = useState(currentSettings.portal_wifi_network ?? "")
  const [wifiPassword, setWifiPassword] = useState(currentSettings.portal_wifi_password ?? "")
  const [hotelInfo, setHotelInfo] = useState(currentSettings.portal_hotel_info ?? "")

  // AI settings state
  const [aiEnabled, setAiEnabled] = useState(currentSettings.ai_enabled ?? false)
  const [aiProvider, setAiProvider] = useState<AIProvider>((currentSettings.ai_provider as AIProvider) ?? "openai")
  const [aiApiKey, setAiApiKey] = useState(currentSettings.ai_api_key ?? "")
  const [aiModel, setAiModel] = useState(currentSettings.ai_model ?? DEFAULT_MODELS.openai)
  const [aiScheduleStart, setAiScheduleStart] = useState(currentSettings.ai_schedule_start ?? "00:00")
  const [aiScheduleEnd, setAiScheduleEnd] = useState(currentSettings.ai_schedule_end ?? "23:59")
  const [aiKnowledgeBase, setAiKnowledgeBase] = useState(currentSettings.ai_knowledge_base ?? "")
  const [aiPersonality, setAiPersonality] = useState(currentSettings.ai_personality ?? "cordiale e professionale")

  // Services state
  const [services, setServices] = useState(initialServices)
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false)
  const [editingService, setEditingService] = useState<PortalService | null>(null)

  // Attractions state
  const [attractions, setAttractions] = useState(initialAttractions)
  const [attractionDialogOpen, setAttractionDialogOpen] = useState(false)
  const [editingAttraction, setEditingAttraction] = useState<PortalAttraction | null>(null)

  // ── Save General + AI Settings ──────────────────────────────────

  function handleSaveSettings() {
    startTransition(async () => {
      const result = await savePortalSettings(propertyId, {
        portal_enabled: portalEnabled,
        portal_whatsapp_number: whatsappNumber,
        portal_welcome_message: welcomeMessage,
        portal_wifi_network: wifiNetwork,
        portal_wifi_password: wifiPassword,
        portal_hotel_info: hotelInfo,
        ai_enabled: aiEnabled,
        ai_provider: aiProvider,
        ai_api_key: aiApiKey,
        ai_model: aiModel,
        ai_schedule_start: aiScheduleStart,
        ai_schedule_end: aiScheduleEnd,
        ai_knowledge_base: aiKnowledgeBase,
        ai_personality: aiPersonality,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Impostazioni salvate")
      }
    })
  }

  // ── Refresh data ──────────────────────────────────

  async function refreshServices() {
    const res = await getPortalServices(propertyId)
    if (res.data) setServices(res.data as PortalService[])
  }

  async function refreshAttractions() {
    const res = await getPortalAttractions(propertyId)
    if (res.data) setAttractions(res.data as PortalAttraction[])
  }

  return (
    <div className="space-y-8">
      {/* ── General Settings ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impostazioni Generali</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Portale Attivo</Label>
              <p className="text-xs text-muted-foreground">Abilita l'accesso ospiti</p>
            </div>
            <Switch checked={portalEnabled} onCheckedChange={setPortalEnabled} />
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Numero WhatsApp</Label>
              <Input placeholder="393331234567" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} />
              <p className="text-xs text-muted-foreground">Formato internazionale senza +</p>
            </div>
            <div className="space-y-2">
              <Label>Rete WiFi</Label>
              <Input placeholder="HotelWiFi" value={wifiNetwork} onChange={(e) => setWifiNetwork(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Password WiFi</Label>
              <Input placeholder="password123" value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Messaggio di Benvenuto</Label>
            <Textarea
              placeholder="Benvenuto nel nostro hotel! Siamo felici di averti con noi..."
              value={welcomeMessage}
              onChange={(e) => setWelcomeMessage(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Info Hotel / Regole</Label>
            <Textarea
              placeholder="Colazione dalle 7:30 alle 10:00. Parcheggio gratuito..."
              value={hotelInfo}
              onChange={(e) => setHotelInfo(e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── AI Concierge Settings ──────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Segreteria AI (Concierge Virtuale)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Concierge AI Attivo</Label>
              <p className="text-xs text-muted-foreground">Chat AI per gli ospiti</p>
            </div>
            <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </div>
          <Separator />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select value={aiProvider} onValueChange={(v) => {
                const p = v as AIProvider
                setAiProvider(p)
                setAiModel(DEFAULT_MODELS[p])
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PROVIDER_LABELS) as AIProvider[]).map((p) => (
                    <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Modello</Label>
              <Select value={aiModel} onValueChange={setAiModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS[aiProvider]?.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>API Key</Label>
              <Input
                type="password"
                placeholder="sk-..."
                value={aiApiKey}
                onChange={(e) => setAiApiKey(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Orario inizio</Label>
              <Input type="time" value={aiScheduleStart} onChange={(e) => setAiScheduleStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Orario fine</Label>
              <Input type="time" value={aiScheduleEnd} onChange={(e) => setAiScheduleEnd(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Imposta 00:00 - 23:59 per "sempre attivo". Fuori orario l'AI risponde con disclaimer.
          </p>
          <div className="space-y-2">
            <Label>Personalità</Label>
            <Input
              placeholder="cordiale, professionale e conciso"
              value={aiPersonality}
              onChange={(e) => setAiPersonality(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Knowledge Base</Label>
            <Textarea
              placeholder="Il nostro hotel si trova a... Offriamo colazione dalle 7:30 alle 10:00... Il parcheggio costa... Le spiagge più vicine sono..."
              value={aiKnowledgeBase}
              onChange={(e) => setAiKnowledgeBase(e.target.value)}
              rows={8}
            />
            <p className="text-xs text-muted-foreground">
              Scrivi tutte le informazioni che vuoi che l'AI conosca sull'hotel e la zona
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <Button onClick={handleSaveSettings} disabled={isPending}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
        Salva Impostazioni
      </Button>

      <Separator />

      {/* ── Services CRUD ──────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Servizi</CardTitle>
          <Button size="sm" onClick={() => { setEditingService(null); setServiceDialogOpen(true) }}>
            <Plus className="mr-1 h-4 w-4" /> Aggiungi
          </Button>
        </CardHeader>
        <CardContent>
          {services.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun servizio configurato</p>
          ) : (
            <div className="space-y-2">
              {services.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{s.name}</span>
                        <Badge variant="outline" className="text-xs">{s.category}</Badge>
                        {!s.is_active && <Badge variant="secondary" className="text-xs">Disattivo</Badge>}
                      </div>
                      {s.price != null && (
                        <span className="text-xs text-muted-foreground">€{Number(s.price).toFixed(2)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingService(s); setServiceDialogOpen(true) }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      startTransition(async () => {
                        const res = await deletePortalService(s.id)
                        if (res.error) toast.error(res.error)
                        else { toast.success("Eliminato"); refreshServices() }
                      })
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Attractions CRUD ──────────────────────────────── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Attrazioni & Consigli</CardTitle>
          <Button size="sm" onClick={() => { setEditingAttraction(null); setAttractionDialogOpen(true) }}>
            <Plus className="mr-1 h-4 w-4" /> Aggiungi
          </Button>
        </CardHeader>
        <CardContent>
          {attractions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna attrazione configurata</p>
          ) : (
            <div className="space-y-2">
              {attractions.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{a.name}</span>
                      <Badge variant="outline" className="text-xs">{a.category}</Badge>
                      {!a.is_active && <Badge variant="secondary" className="text-xs">Disattivo</Badge>}
                    </div>
                    {a.external_url && (
                      <span className="text-xs text-muted-foreground truncate block max-w-xs">{a.external_url}</span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditingAttraction(a); setAttractionDialogOpen(true) }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => {
                      startTransition(async () => {
                        const res = await deletePortalAttraction(a.id)
                        if (res.error) toast.error(res.error)
                        else { toast.success("Eliminato"); refreshAttractions() }
                      })
                    }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Service Dialog ──────────────────────────────── */}
      <ServiceDialog
        open={serviceDialogOpen}
        onOpenChange={setServiceDialogOpen}
        editing={editingService}
        propertyId={propertyId}
        onSaved={refreshServices}
      />

      {/* ── Attraction Dialog ──────────────────────────────── */}
      <AttractionDialog
        open={attractionDialogOpen}
        onOpenChange={setAttractionDialogOpen}
        editing={editingAttraction}
        propertyId={propertyId}
        onSaved={refreshAttractions}
      />
    </div>
  )
}

// ── Service Dialog ──────────────────────────────────

type ServiceFormValues = z.infer<typeof portalServiceSchema>

function ServiceDialog({
  open,
  onOpenChange,
  editing,
  propertyId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: PortalService | null
  propertyId: string
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<ServiceFormValues>({
    resolver: zodResolver(portalServiceSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          description: editing.description ?? "",
          category: editing.category,
          price: editing.price != null ? Number(editing.price) : null,
          image_url: editing.image_url ?? "",
          sort_order: editing.sort_order,
          is_active: editing.is_active,
        }
      : {
          name: "",
          description: "",
          category: "general",
          price: null,
          image_url: "",
          sort_order: 0,
          is_active: true,
        },
  })

  // Reset form when editing changes
  const formKey = editing?.id ?? "new"

  function onSubmit(values: ServiceFormValues) {
    startTransition(async () => {
      const res = editing
        ? await updatePortalService(editing.id, values)
        : await createPortalService(propertyId, values)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(editing ? "Servizio aggiornato" : "Servizio creato")
        onOpenChange(false)
        onSaved()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={formKey}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Modifica Servizio" : "Nuovo Servizio"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Descrizione</Label>
            <Textarea {...form.register("description")} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prezzo (€)</Label>
              <Input
                type="number"
                step="0.01"
                {...form.register("price", { valueAsNumber: true })}
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ordine</Label>
              <Input type="number" {...form.register("sort_order", { valueAsNumber: true })} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.watch("is_active")} onCheckedChange={(v) => form.setValue("is_active", v)} />
              <Label>Attivo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ── Attraction Dialog ──────────────────────────────────

type AttractionFormValues = z.infer<typeof portalAttractionSchema>

function AttractionDialog({
  open,
  onOpenChange,
  editing,
  propertyId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  editing: PortalAttraction | null
  propertyId: string
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()

  const form = useForm<AttractionFormValues>({
    resolver: zodResolver(portalAttractionSchema),
    defaultValues: editing
      ? {
          name: editing.name,
          description: editing.description ?? "",
          category: editing.category,
          image_url: editing.image_url ?? "",
          external_url: editing.external_url ?? "",
          sort_order: editing.sort_order,
          is_active: editing.is_active,
        }
      : {
          name: "",
          description: "",
          category: "attraction",
          image_url: "",
          external_url: "",
          sort_order: 0,
          is_active: true,
        },
  })

  const formKey = editing?.id ?? "new"

  function onSubmit(values: AttractionFormValues) {
    startTransition(async () => {
      const res = editing
        ? await updatePortalAttraction(editing.id, values)
        : await createPortalAttraction(propertyId, values)
      if (res.error) {
        toast.error(res.error)
      } else {
        toast.success(editing ? "Attrazione aggiornata" : "Attrazione creata")
        onOpenChange(false)
        onSaved()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={formKey}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Modifica Attrazione" : "Nuova Attrazione"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input {...form.register("name")} />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Descrizione</Label>
            <Textarea {...form.register("description")} rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.watch("category")} onValueChange={(v) => form.setValue("category", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ATTRACTION_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>URL Esterno</Label>
              <Input {...form.register("external_url")} placeholder="https://..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ordine</Label>
              <Input type="number" {...form.register("sort_order", { valueAsNumber: true })} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch checked={form.watch("is_active")} onCheckedChange={(v) => form.setValue("is_active", v)} />
              <Label>Attivo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {editing ? "Salva" : "Crea"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
