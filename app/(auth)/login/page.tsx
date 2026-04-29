"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useRouter, useSearchParams } from "next/navigation"
import { Building2, Loader2, Lock, Mail } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const errorParam = searchParams.get("error")
  const initialError =
    errorParam === "disabled"
      ? "Account disattivato. Contatta l'amministratore."
      : errorParam === "unauthorized"
        ? "Non hai i permessi per accedere a questa sezione."
        : ""

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError("Email o password non valide")
      setLoading(false)
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  const showError = error || initialError

  return (
    <div className="w-full max-w-md">
      {/* Logo + brand */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200">
          <Building2 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">HP Service</h1>
          <p className="text-xs text-slate-500">Gestionale strutture ricettive</p>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50">
        <div className="mb-6 space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Accedi al tuo account</h2>
          <p className="text-sm text-slate-500">
            Inserisci le credenziali fornite dal tuo amministratore
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-xs font-medium text-slate-600">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@struttura.com"
                required
                autoComplete="email"
                className="block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-xs font-medium text-slate-600">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="block w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-all focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          </div>

          {showError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
              {showError}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-indigo-600"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Accesso in corso...
              </>
            ) : (
              "Accedi"
            )}
          </button>
        </form>

        <p className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-slate-500">
          Non hai un account? Contatta il tuo amministratore per ricevere le credenziali.
        </p>
      </div>

      <p className="mt-6 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} HP Service · Tutti i diritti riservati
      </p>
    </div>
  )
}
