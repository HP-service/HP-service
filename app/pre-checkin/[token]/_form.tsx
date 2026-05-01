"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Building2, Calendar, Users, CheckCircle2, Loader2, ChevronRight } from "lucide-react"

type Booking = {
  property_name: string
  property_address: string | null
  property_city: string | null
  check_in: string
  check_out: string
  adults: number
  children: number
  booking_number: string
  completed: boolean
}

type FormData = {
  nome: string
  cognome: string
  data_nascita: string
  nazionalita: string
  tipo_documento: string
  numero_documento: string
  telefono: string
  email: string
}

const DOCUMENT_TYPES = [
  { value: "carta_identita", label: "Carta d'identità" },
  { value: "passaporto", label: "Passaporto" },
  { value: "patente", label: "Patente di guida" },
  { value: "permesso_soggiorno", label: "Permesso di soggiorno" },
]

function fmt(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function PreCheckinForm({ token, booking }: { token: string; booking: Booking }) {
  const [step, setStep] = useState<"form" | "success">("form")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>({
    nome: "",
    cognome: "",
    data_nascita: "",
    nazionalita: "",
    tipo_documento: "carta_identita",
    numero_documento: "",
    telefono: "",
    email: "",
  })

  function onChange(field: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!form.nome || !form.cognome || !form.data_nascita || !form.nazionalita || !form.numero_documento) {
      setError("Compila tutti i campi obbligatori.")
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc("submit_precheckin", {
        p_token: token,
        p_data: {
          nome: form.nome.trim(),
          cognome: form.cognome.trim(),
          data_nascita: form.data_nascita,
          nazionalita: form.nazionalita.trim(),
          tipo_documento: form.tipo_documento,
          numero_documento: form.numero_documento.trim().toUpperCase(),
          telefono: form.telefono.trim() || null,
          email: form.email.trim() || null,
          submitted_at: new Date().toISOString(),
        },
      })

      if (rpcError) throw rpcError
      if (!data) throw new Error("Token non valido o pre check-in già effettuato.")

      setStep("success")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Si è verificato un errore. Riprova.")
    } finally {
      setLoading(false)
    }
  }

  if (step === "success") {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Pre check-in completato!</h1>
        <p className="mt-2 text-sm text-slate-500">
          Grazie, {form.nome}! Abbiamo ricevuto i tuoi dati per la prenotazione{" "}
          <strong>{booking.booking_number}</strong>. Ci vediamo in struttura il{" "}
          <strong>{fmt(booking.check_in)}</strong>!
        </p>
        <div className="mt-6 rounded-2xl bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          Porta con te il documento indicato:{" "}
          <strong>
            {DOCUMENT_TYPES.find((d) => d.value === form.tipo_documento)?.label ?? form.tipo_documento}
          </strong>{" "}
          n° <strong>{form.numero_documento}</strong>
        </div>
      </div>
    )
  }

  const nights = Math.round(
    (new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) /
      (1000 * 60 * 60 * 24)
  )

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      {/* Header card */}
      <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">{booking.property_name}</div>
              {(booking.property_city || booking.property_address) && (
                <div className="text-[11px] text-indigo-200">
                  {booking.property_address}
                  {booking.property_city ? `, ${booking.property_city}` : ""}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-100 border-t border-slate-100">
          <div className="flex items-center gap-2 px-4 py-3">
            <Calendar className="h-4 w-4 shrink-0 text-indigo-500" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Check-in
              </div>
              <div className="text-xs font-semibold text-slate-900">{fmt(booking.check_in)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-3">
            <Calendar className="h-4 w-4 shrink-0 text-slate-400" />
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Check-out
              </div>
              <div className="text-xs font-semibold text-slate-900">{fmt(booking.check_out)}</div>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          <Users className="mr-1 inline h-3.5 w-3.5" />
          {booking.adults} adulti{booking.children > 0 ? ` + ${booking.children} bambini` : ""} ·{" "}
          {nights} {nights === 1 ? "notte" : "notti"} · Prenotazione{" "}
          <strong className="text-slate-700">{booking.booking_number}</strong>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <h2 className="mb-1 text-base font-bold text-slate-900">Pre check-in digitale</h2>
          <p className="text-xs text-slate-500">
            Inserisci i tuoi dati per velocizzare il check-in in struttura. I campi con{" "}
            <span className="text-rose-500">*</span> sono obbligatori.
          </p>
        </div>

        {/* Nome + Cognome */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Nome <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.nome}
              onChange={(e) => onChange("nome", e.target.value)}
              placeholder="Mario"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Cognome <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.cognome}
              onChange={(e) => onChange("cognome", e.target.value)}
              placeholder="Rossi"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Data nascita + Nazionalità */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Data di nascita <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              required
              value={form.data_nascita}
              onChange={(e) => onChange("data_nascita", e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Nazionalità <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.nazionalita}
              onChange={(e) => onChange("nazionalita", e.target.value)}
              placeholder="Italiana"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {/* Tipo documento */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Tipo documento <span className="text-rose-500">*</span>
          </label>
          <select
            required
            value={form.tipo_documento}
            onChange={(e) => onChange("tipo_documento", e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {DOCUMENT_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* Numero documento */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-700">
            Numero documento <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.numero_documento}
            onChange={(e) => onChange("numero_documento", e.target.value.toUpperCase())}
            placeholder="AB1234567"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Telefono + Email (facoltativi) */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Telefono</label>
            <input
              type="tel"
              value={form.telefono}
              onChange={(e) => onChange("telefono", e.target.value)}
              placeholder="+39 333 000 0000"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="mario@email.it"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Completa pre check-in
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>

        <p className="text-center text-[11px] text-slate-400">
          I tuoi dati vengono trasmessi in modo sicuro e usati esclusivamente per il check-in in
          struttura.
        </p>
      </form>
    </div>
  )
}
