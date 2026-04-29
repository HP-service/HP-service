"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Sparkles,
  Wifi,
  Coffee,
  Key,
  MapPin,
  Phone,
  Compass,
  ShieldCheck,
  Info,
  Save,
  X,
} from "lucide-react"
import {
  upsertInfoPage,
  deleteInfoPage,
  TEMPLATES,
  type InfoPage,
} from "../_actions"
import { useRouter } from "next/navigation"

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  info: Info,
  wifi: Wifi,
  coffee: Coffee,
  key: Key,
  "map-pin": MapPin,
  phone: Phone,
  compass: Compass,
  "shield-check": ShieldCheck,
  sparkles: Sparkles,
}

export function InfoOspitiClient({ initialPages }: { initialPages: InfoPage[] }) {
  const router = useRouter()
  const [pages, setPages] = useState<InfoPage[]>(initialPages)
  const [showTemplates, setShowTemplates] = useState(initialPages.length === 0)
  const [editor, setEditor] = useState<{
    id?: string
    title: string
    icon: string
    content: string
    is_active: boolean
  } | null>(null)
  const [isPending, startTransition] = useTransition()

  function openNew(template?: typeof TEMPLATES[number]) {
    setEditor({
      title: template?.title ?? "",
      icon: template?.icon ?? "info",
      content: template?.content ?? "",
      is_active: true,
    })
  }

  function openEdit(p: InfoPage) {
    setEditor({
      id: p.id,
      title: p.title,
      icon: p.icon,
      content: p.content,
      is_active: p.is_active,
    })
  }

  function save() {
    if (!editor) return
    startTransition(async () => {
      const res = await upsertInfoPage(editor)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(editor.id ? "Pagina aggiornata" : "Pagina creata")
      setEditor(null)
      router.refresh()
    })
  }

  function remove(id: string) {
    if (!confirm("Eliminare questa pagina?")) return
    startTransition(async () => {
      const res = await deleteInfoPage(id)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setPages((prev) => prev.filter((p) => p.id !== id))
      toast.success("Pagina eliminata")
    })
  }

  function toggleActive(p: InfoPage) {
    startTransition(async () => {
      const res = await upsertInfoPage({
        id: p.id,
        title: p.title,
        icon: p.icon,
        content: p.content,
        is_active: !p.is_active,
        sort_order: p.sort_order,
      })
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      setPages((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, is_active: !x.is_active } : x)),
      )
    })
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowTemplates((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          {showTemplates ? "Nascondi modelli" : "Modelli pronti"}
        </button>
        <button
          type="button"
          onClick={() => openNew()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-200 transition-colors hover:bg-indigo-700"
        >
          <Plus className="h-3.5 w-3.5" />
          Pagina vuota
        </button>
      </div>

      {/* Templates picker */}
      {showTemplates ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-semibold text-slate-800">
              Inizia da un modello
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {TEMPLATES.map((t) => {
              const Icon = ICONS[t.icon] ?? Info
              return (
                <button
                  key={t.title}
                  type="button"
                  onClick={() => openNew(t)}
                  className="group flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-left transition-all hover:border-indigo-300 hover:bg-white hover:shadow-md"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm transition-colors group-hover:bg-indigo-50">
                    <Icon className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="text-sm font-bold text-slate-900">{t.title}</div>
                  <div className="line-clamp-2 text-[11px] text-slate-500">
                    {t.content.replace(/[*#]/g, "").slice(0, 60)}…
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

      {/* Lista pagine */}
      {pages.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
            <Info className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-700">
            Nessuna pagina informativa
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Inizia da un modello qui sopra o crea una pagina vuota.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {pages.map((p) => {
            const Icon = ICONS[p.icon] ?? Info
            return (
              <div
                key={p.id}
                className={`rounded-2xl border bg-white p-4 transition-all hover:shadow-md ${
                  p.is_active ? "border-slate-200" : "border-slate-200 opacity-60"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                    <Icon className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-slate-900">
                        {p.title}
                      </h3>
                      {!p.is_active ? (
                        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-500">
                          Bozza
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                      {p.content.replace(/[*#]/g, "").slice(0, 110) || "—"}
                    </p>
                    <div className="mt-3 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil className="h-3 w-3" />
                        Modifica
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleActive(p)}
                        disabled={isPending}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      >
                        {p.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {p.is_active ? "Pubblica" : "Bozza"}
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(p.id)}
                        disabled={isPending}
                        className="ml-auto inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Editor modal */}
      {editor ? (
        <div className="fixed inset-0 z-[800] flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 className="text-sm font-bold text-slate-900">
                {editor.id ? "Modifica pagina" : "Nuova pagina"}
              </h2>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block text-xs font-medium text-slate-600">
                    Titolo *
                  </label>
                  <input
                    value={editor.title}
                    onChange={(e) =>
                      setEditor({ ...editor, title: e.target.value })
                    }
                    placeholder="es. WiFi, Colazione, Come arrivare"
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-slate-600">
                    Icona
                  </label>
                  <select
                    value={editor.icon}
                    onChange={(e) => setEditor({ ...editor, icon: e.target.value })}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  >
                    {Object.keys(ICONS).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-600">
                  Contenuto (Markdown)
                </label>
                <textarea
                  value={editor.content}
                  onChange={(e) =>
                    setEditor({ ...editor, content: e.target.value })
                  }
                  rows={12}
                  placeholder="Scrivi qui il contenuto della pagina. Puoi usare **grassetto**, *corsivo*, liste con - e titoli con #."
                  className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-xs text-slate-800 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={editor.is_active}
                  onChange={(e) =>
                    setEditor({ ...editor, is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                Pubblica subito (visibile agli ospiti)
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={save}
                disabled={isPending || !editor.title.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-200 transition-colors hover:bg-indigo-700 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {isPending ? "Salvataggio..." : "Salva"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
