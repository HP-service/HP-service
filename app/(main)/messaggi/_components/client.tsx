"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
  X,
  Loader2,
  Copy,
  Info,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@ui/dialog"
import { Button } from "@ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ui/select"
import {
  upsertTemplate,
  deleteTemplate,
  seedDefaultTemplates,
  type MessageTemplate,
} from "../_actions"

const VARS = [
  { key: "guest_name", label: "Nome ospite" },
  { key: "property_name", label: "Nome struttura" },
  { key: "property_address", label: "Indirizzo struttura" },
  { key: "property_phone", label: "Telefono struttura" },
  { key: "check_in", label: "Data check-in" },
  { key: "check_out", label: "Data check-out" },
  { key: "check_in_time", label: "Orario check-in" },
  { key: "check_out_time", label: "Orario check-out" },
  { key: "nights", label: "Numero notti" },
  { key: "booking_number", label: "Numero prenotazione" },
  { key: "total_amount", label: "Importo totale" },
  { key: "precheckin_link", label: "Link pre check-in" },
  { key: "access_code", label: "Codice di accesso" },
]

const KIND_LABELS: Record<MessageTemplate["kind"], string> = {
  PreArrival: "Pre-arrivo",
  Welcome: "Welcome",
  PostCheckout: "Post-checkout",
  Custom: "Personalizzato",
}

const KIND_COLORS: Record<MessageTemplate["kind"], string> = {
  PreArrival: "bg-blue-100 text-blue-700",
  Welcome: "bg-emerald-100 text-emerald-700",
  PostCheckout: "bg-violet-100 text-violet-700",
  Custom: "bg-slate-100 text-slate-700",
}

const CHANNEL_ICONS: Record<MessageTemplate["channel"], React.ReactNode> = {
  Email: <Mail className="h-3.5 w-3.5" />,
  WhatsApp: <MessageCircle className="h-3.5 w-3.5" />,
  SMS: <Phone className="h-3.5 w-3.5" />,
}

export function MessagesClient({ templates }: { templates: MessageTemplate[] }) {
  const router = useRouter()
  const [editing, setEditing] = useState<MessageTemplate | null>(null)
  const [creating, setCreating] = useState(false)
  const [isPending, startTransition] = useTransition()

  function onSeed() {
    startTransition(async () => {
      const r = await seedDefaultTemplates()
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success(r.data === 0 ? "Tutti i template predefiniti già presenti" : `${r.data} template aggiunti`)
      router.refresh()
    })
  }

  function onDelete(id: string) {
    if (!confirm("Eliminare questo template?")) return
    startTransition(async () => {
      const r = await deleteTemplate(id)
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success("Template eliminato")
      router.refresh()
    })
  }

  const grouped = templates.reduce(
    (acc, t) => {
      ;(acc[t.kind] ??= []).push(t)
      return acc
    },
    {} as Record<MessageTemplate["kind"], MessageTemplate[]>
  )

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Templates messaggi
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Email, WhatsApp e SMS preformattati per pre-arrivo, welcome e post-checkout.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {templates.length === 0 && (
            <Button variant="outline" onClick={onSeed} disabled={isPending}>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Carica template predefiniti
            </Button>
          )}
          <Button onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Nuovo template
          </Button>
        </div>
      </div>

      {/* Variables help */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-blue-800">
            Variabili disponibili (vengono sostituite automaticamente con i dati della prenotazione)
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {VARS.map((v) => (
              <code
                key={v.key}
                className="rounded-md bg-white px-2 py-0.5 text-[11px] font-mono text-blue-700 border border-blue-200"
                title={v.label}
              >
                {`{{${v.key}}}`}
              </code>
            ))}
          </div>
        </div>
      </div>

      {/* Empty state */}
      {templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-16 text-center">
          <Mail className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">Nessun template</p>
          <p className="mt-1 text-xs text-slate-500">
            Inizia caricando i template predefiniti o creandone uno nuovo.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.keys(grouped) as MessageTemplate["kind"][]).map((kind) => (
            <div key={kind}>
              <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                {KIND_LABELS[kind]} ({grouped[kind].length})
              </h2>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {grouped[kind].map((t) => (
                  <div
                    key={t.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-200 hover:shadow-sm"
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${KIND_COLORS[t.kind]}`}
                          >
                            {KIND_LABELS[t.kind]}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            {CHANNEL_ICONS[t.channel]}
                            {t.channel}
                          </span>
                          {t.is_default && (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                              ★
                            </span>
                          )}
                        </div>
                        <h3 className="truncate text-sm font-bold text-slate-900">{t.name}</h3>
                        {t.subject && (
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {t.subject}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => setEditing(t)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="Modifica"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(t.id)}
                          disabled={isPending}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          title="Elimina"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="line-clamp-3 text-xs leading-relaxed text-slate-600 whitespace-pre-line">
                      {t.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create dialog */}
      {(editing || creating) && (
        <TemplateDialog
          template={editing}
          onClose={() => {
            setEditing(null)
            setCreating(false)
          }}
        />
      )}
    </div>
  )
}

function TemplateDialog({
  template,
  onClose,
}: {
  template: MessageTemplate | null
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState({
    name: template?.name ?? "",
    kind: (template?.kind ?? "PreArrival") as MessageTemplate["kind"],
    channel: (template?.channel ?? "Email") as MessageTemplate["channel"],
    subject: template?.subject ?? "",
    body: template?.body ?? "",
  })

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.body.trim()) {
      toast.error("Nome e corpo del messaggio sono obbligatori")
      return
    }
    startTransition(async () => {
      const r = await upsertTemplate({
        id: template?.id,
        name: form.name.trim(),
        kind: form.kind,
        channel: form.channel,
        subject: form.subject.trim() || null,
        body: form.body,
      })
      if (r.error) {
        toast.error(r.error)
        return
      }
      toast.success(template ? "Template aggiornato" : "Template creato")
      onClose()
      router.refresh()
    })
  }

  function insertVar(key: string) {
    const placeholder = `{{${key}}}`
    setForm({ ...form, body: form.body + placeholder })
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {template ? "Modifica template" : "Nuovo template messaggio"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-3">
              <label className="mb-1 block text-xs font-semibold">Nome</label>
              <input
                required
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="es. Pre-arrivo standard"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Tipo</label>
              <Select
                value={form.kind}
                onValueChange={(v) => setForm({ ...form, kind: v as MessageTemplate["kind"] })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PreArrival">Pre-arrivo</SelectItem>
                  <SelectItem value="Welcome">Welcome</SelectItem>
                  <SelectItem value="PostCheckout">Post-checkout</SelectItem>
                  <SelectItem value="Custom">Personalizzato</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold">Canale</label>
              <Select
                value={form.channel}
                onValueChange={(v) => setForm({ ...form, channel: v as MessageTemplate["channel"] })}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="SMS">SMS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.channel === "Email" && (
            <div>
              <label className="mb-1 block text-xs font-semibold">Oggetto</label>
              <input
                type="text"
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="es. Benvenuto a {{property_name}}"
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold">Corpo del messaggio</label>
              <span className="text-[11px] text-slate-500">{form.body.length} caratteri</span>
            </div>
            <textarea
              required
              rows={10}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder={"Ciao {{guest_name}},\n\n..."}
              className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {VARS.slice(0, 8).map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insertVar(v.key)}
                  className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-mono text-indigo-700 hover:bg-indigo-100"
                  title={v.label}
                >
                  + {`{{${v.key}}}`}
                </button>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annulla
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Compose dialog (used in booking detail)
// ============================================================================

export function ComposeDialog({
  open,
  onClose,
  templates,
  vars,
  guestEmail,
  guestPhone,
}: {
  open: boolean
  onClose: () => void
  templates: MessageTemplate[]
  vars: Record<string, string | undefined>
  guestEmail?: string | null
  guestPhone?: string | null
}) {
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id ?? "")
  const selected = templates.find((t) => t.id === selectedId)

  function substitute(text: string): string {
    let out = text
    for (const [k, v] of Object.entries(vars)) {
      if (v === undefined || v === null) continue
      out = out.replaceAll(`{{${k}}}`, String(v))
    }
    return out.replace(/\{\{[a-z_]+\}\}/g, "")
  }

  const subject = selected ? substitute(selected.subject ?? "") : ""
  const body = selected ? substitute(selected.body) : ""

  function copyText() {
    const text = subject ? `${subject}\n\n${body}` : body
    navigator.clipboard.writeText(text)
    toast.success("Testo copiato")
  }

  function openMailto() {
    if (!guestEmail) return toast.error("Email ospite non disponibile")
    const url = `mailto:${guestEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    window.location.href = url
  }

  function openWhatsApp() {
    const phone = (guestPhone ?? "").replace(/[^0-9+]/g, "")
    if (!phone) return toast.error("Telefono ospite non disponibile")
    const url = `https://wa.me/${phone.replace(/^\+/, "")}?text=${encodeURIComponent(body)}`
    window.open(url, "_blank")
  }

  if (!open) return null

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Invia messaggio</DialogTitle>
        </DialogHeader>

        {templates.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Nessun template disponibile. Crea i tuoi template nella sezione{" "}
            <a href="/messaggi" className="font-semibold text-indigo-600 underline">
              Messaggi
            </a>
            .
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold">Template</label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {KIND_LABELS[t.kind]} · {t.channel} · {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected?.subject && (
              <div>
                <label className="mb-1 block text-xs font-semibold">Oggetto</label>
                <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">{subject}</div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold">Anteprima</label>
              <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap rounded-lg border bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
                {body}
              </pre>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copyText} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copia testo
              </Button>
              {selected?.channel === "Email" && (
                <Button onClick={openMailto} className="gap-1.5" disabled={!guestEmail}>
                  <Mail className="h-3.5 w-3.5" />
                  Apri email
                </Button>
              )}
              {selected?.channel === "WhatsApp" && (
                <Button
                  onClick={openWhatsApp}
                  className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
                  disabled={!guestPhone}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Apri WhatsApp
                </Button>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
