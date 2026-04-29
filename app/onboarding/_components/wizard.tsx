"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Building2,
  MapPin,
  User,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sparkles,
} from "lucide-react"
import { completeSetup, type SetupInput } from "../_actions"

const STEPS = [
  { id: 1, title: "Struttura", description: "Nome e contatti", icon: Building2 },
  { id: 2, title: "Sede", description: "Indirizzo e fiscali", icon: MapPin },
  { id: 3, title: "Amministratore", description: "I tuoi dati", icon: User },
  { id: 4, title: "Conferma", description: "Riepilogo e setup", icon: Check },
]

const empty: SetupInput = {
  name: "",
  address: "",
  city: "",
  postal_code: "",
  province: "",
  country: "Italia",
  vat_number: "",
  cin_code: "",
  phone: "",
  email: "",
  full_name: "",
}

export function OnboardingWizard({
  defaultEmail,
  defaultName,
}: {
  defaultEmail: string
  defaultName: string
}) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<SetupInput>({
    ...empty,
    email: defaultEmail,
    full_name: defaultName,
  })
  const [isPending, startTransition] = useTransition()

  const update = <K extends keyof SetupInput>(key: K, val: SetupInput[K]) =>
    setData((d) => ({ ...d, [key]: val }))

  const canNext = (() => {
    if (step === 1) return data.name.trim().length >= 2
    if (step === 2)
      return (
        data.address.trim().length >= 3 &&
        data.city.trim().length >= 2 &&
        data.postal_code.trim().length >= 3
      )
    if (step === 3) return data.full_name.trim().length >= 2
    return true
  })()

  const onSubmit = () => {
    startTransition(async () => {
      const res = await completeSetup(data)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success("Struttura creata! Benvenuto in HP Service.")
      router.push("/dashboard")
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-4 py-10">
      {/* Brand */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Configura la tua struttura</h1>
          <p className="text-sm text-slate-500">
            Pochi minuti per iniziare a gestire prenotazioni, ospiti e finanze.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8 w-full">
        <div className="flex items-center justify-between gap-2">
          {STEPS.map((s, i) => {
            const isDone = step > s.id
            const isCurrent = step === s.id
            const Icon = s.icon
            return (
              <div key={s.id} className="flex flex-1 items-center gap-2">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                      isDone
                        ? "bg-emerald-500 text-white shadow-md shadow-emerald-200"
                        : isCurrent
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 ring-4 ring-indigo-100"
                          : "bg-white text-slate-400 ring-2 ring-slate-200"
                    }`}
                  >
                    {isDone ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="hidden text-center md:block">
                    <div
                      className={`text-xs font-semibold ${
                        isCurrent ? "text-indigo-700" : isDone ? "text-emerald-700" : "text-slate-500"
                      }`}
                    >
                      {s.title}
                    </div>
                    <div className="text-[10px] text-slate-400">{s.description}</div>
                  </div>
                </div>
                {i < STEPS.length - 1 ? (
                  <div
                    className={`mb-6 h-0.5 flex-1 rounded-full transition-colors ${
                      step > s.id ? "bg-emerald-500" : "bg-slate-200"
                    }`}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {/* Card */}
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
        {step === 1 ? (
          <Step1 data={data} update={update} />
        ) : step === 2 ? (
          <Step2 data={data} update={update} />
        ) : step === 3 ? (
          <Step3 data={data} update={update} />
        ) : (
          <Step4 data={data} />
        )}

        {/* Nav */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
          <button
            type="button"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || isPending}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Indietro
          </button>

          {step < STEPS.length ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
              disabled={!canNext || isPending}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Avanti
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={isPending}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:shadow-indigo-300 disabled:opacity-50"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creazione...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Completa setup
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
// Step 1 — Struttura
function Step1({
  data,
  update,
}: {
  data: SetupInput
  update: <K extends keyof SetupInput>(k: K, v: SetupInput[K]) => void
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">Inizia dalla tua struttura</h2>
      <p className="mb-6 text-sm text-slate-500">
        Come si chiama? Aggiungi telefono ed email se vuoi mostrarli ai tuoi ospiti.
      </p>

      <div className="space-y-4">
        <Field
          label="Nome struttura *"
          placeholder="es. Sorrento Flats"
          value={data.name}
          onChange={(v) => update("name", v)}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Telefono"
            placeholder="+39 081 0000000"
            value={data.phone || ""}
            onChange={(v) => update("phone", v)}
          />
          <Field
            label="Email pubblica"
            type="email"
            placeholder="info@struttura.com"
            value={data.email || ""}
            onChange={(v) => update("email", v)}
          />
        </div>
      </div>
    </div>
  )
}

// Step 2 — Sede + dati fiscali
function Step2({
  data,
  update,
}: {
  data: SetupInput
  update: <K extends keyof SetupInput>(k: K, v: SetupInput[K]) => void
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">Dove si trova?</h2>
      <p className="mb-6 text-sm text-slate-500">
        Indirizzo della struttura e dati fiscali per fatture e ISTAT.
      </p>

      <div className="space-y-4">
        <Field
          label="Indirizzo *"
          placeholder="es. Via Roma 12"
          value={data.address}
          onChange={(v) => update("address", v)}
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Field
              label="Città *"
              placeholder="es. Sorrento"
              value={data.city}
              onChange={(v) => update("city", v)}
            />
          </div>
          <Field
            label="CAP *"
            placeholder="80067"
            value={data.postal_code}
            onChange={(v) => update("postal_code", v)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Provincia"
            placeholder="NA"
            value={data.province || ""}
            onChange={(v) => update("province", v.toUpperCase())}
          />
          <Field
            label="Nazione"
            value={data.country}
            onChange={(v) => update("country", v)}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="P. IVA"
            placeholder="01234567890"
            value={data.vat_number || ""}
            onChange={(v) => update("vat_number", v)}
          />
          <Field
            label="CIN"
            placeholder="IT006...A"
            value={data.cin_code || ""}
            onChange={(v) => update("cin_code", v.toUpperCase())}
            hint="Codice Identificativo Nazionale strutture ricettive"
          />
        </div>
      </div>
    </div>
  )
}

// Step 3 — Admin
function Step3({
  data,
  update,
}: {
  data: SetupInput
  update: <K extends keyof SetupInput>(k: K, v: SetupInput[K]) => void
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">I tuoi dati</h2>
      <p className="mb-6 text-sm text-slate-500">
        Sarai l'amministratore della struttura. Potrai aggiungere altri utenti
        (Reception, Pulizie) dopo dalla sezione Impostazioni.
      </p>

      <Field
        label="Nome e cognome *"
        placeholder="es. Mario Rossi"
        value={data.full_name}
        onChange={(v) => update("full_name", v)}
      />
    </div>
  )
}

// Step 4 — Riepilogo
function Step4({ data }: { data: SetupInput }) {
  const rows: Array<[string, string | undefined]> = [
    ["Struttura", data.name],
    ["Indirizzo", `${data.address}, ${data.postal_code} ${data.city}${data.province ? ` (${data.province})` : ""}`],
    ["Nazione", data.country],
    ["Telefono", data.phone || "—"],
    ["Email", data.email || "—"],
    ["P. IVA", data.vat_number || "—"],
    ["CIN", data.cin_code || "—"],
    ["Amministratore", data.full_name],
  ]
  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900">Tutto pronto?</h2>
      <p className="mb-6 text-sm text-slate-500">
        Verifica i dati. Potrai modificare tutto in qualsiasi momento da Impostazioni.
      </p>

      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </span>
            <span className="text-right text-sm font-semibold text-slate-900">
              {value || "—"}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ───────────────────────────────────────────────────────────────────
function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-slate-600">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
      />
      {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
    </div>
  )
}
