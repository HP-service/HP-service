"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Search, Plus, X, BookOpen, Users as UsersIcon, BedDouble } from "lucide-react"
import { searchAll, type SearchHit } from "@db/queries/search"

export function TopBar() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Cmd/Ctrl + K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen(true)
        setTimeout(() => inputRef.current?.focus(), 0)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // click fuori → chiudi
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) {
      window.addEventListener("mousedown", onClick)
      return () => window.removeEventListener("mousedown", onClick)
    }
  }, [open])

  // Debounced search
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setHits([])
      return
    }
    setLoading(true)
    const handle = setTimeout(async () => {
      const res = await searchAll(query.trim())
      if (res.ok) setHits(res.hits)
      setLoading(false)
    }, 250)
    return () => clearTimeout(handle)
  }, [query])

  function go(href: string) {
    setOpen(false)
    setQuery("")
    setHits([])
    router.push(href)
  }

  return (
    <div ref={containerRef} className="relative flex flex-1 items-center gap-2">
      {/* Search input */}
      <div className="relative flex-1 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          placeholder="Cerca ospite, prenotazione, camera..."
          className="block w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-16 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-500 sm:block">
          ⌘K
        </kbd>

        {/* Dropdown risultati */}
        {open && (query.length >= 2 || loading) ? (
          <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            {loading ? (
              <div className="px-4 py-3 text-xs text-slate-500">Cerco...</div>
            ) : hits.length === 0 ? (
              <div className="px-4 py-3 text-xs text-slate-500">
                Nessun risultato per &laquo;{query}&raquo;
              </div>
            ) : (
              <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                {hits.map((h) => (
                  <li key={h.kind + h.id}>
                    <button
                      type="button"
                      onClick={() => go(h.href)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50"
                    >
                      <KindIcon kind={h.kind} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {h.title}
                        </div>
                        {h.subtitle ? (
                          <div className="truncate text-xs text-slate-500">{h.subtitle}</div>
                        ) : null}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase text-slate-600">
                        {kindLabel(h.kind)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </div>

      {/* Quick add */}
      <Link
        href="/bookings/new"
        className="hidden items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-200 transition-colors hover:bg-indigo-700 sm:inline-flex"
      >
        <Plus className="h-3.5 w-3.5" />
        Nuova prenotazione
      </Link>
      <Link
        href="/bookings/new"
        className="inline-flex items-center justify-center rounded-xl bg-indigo-600 p-2 text-white shadow-md shadow-indigo-200 transition-colors hover:bg-indigo-700 sm:hidden"
        aria-label="Nuova prenotazione"
      >
        <Plus className="h-4 w-4" />
      </Link>
    </div>
  )
}

function KindIcon({ kind }: { kind: SearchHit["kind"] }) {
  const cls = "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
  if (kind === "booking")
    return (
      <div className={`${cls} bg-indigo-50 text-indigo-600`}>
        <BookOpen className="h-4 w-4" />
      </div>
    )
  if (kind === "guest")
    return (
      <div className={`${cls} bg-emerald-50 text-emerald-600`}>
        <UsersIcon className="h-4 w-4" />
      </div>
    )
  return (
    <div className={`${cls} bg-amber-50 text-amber-600`}>
      <BedDouble className="h-4 w-4" />
    </div>
  )
}

function kindLabel(k: SearchHit["kind"]) {
  if (k === "booking") return "Pren."
  if (k === "guest") return "Ospite"
  return "Camera"
}
