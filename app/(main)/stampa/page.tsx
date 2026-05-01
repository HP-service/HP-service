export const dynamic = "force-dynamic"

import Link from "next/link"
import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import { Printer, KeyRound, LogOut, Sparkles } from "lucide-react"

export default async function StampaIndexPage() {
  await requireRole(MAIN_APP_ROLES)
  const today = new Date().toISOString().slice(0, 10)

  const cards = [
    {
      href: `/stampa/giornata?date=${today}`,
      title: "Giornata operativa",
      desc: "Arrivi, partenze e ospiti in casa di oggi — A4 da stampare per la reception.",
      icon: KeyRound,
      accent: "from-indigo-500 to-violet-500",
    },
    {
      href: `/stampa/pulizie?date=${today}`,
      title: "Foglio pulizie staff",
      desc: "Lista camere da pulire con priorità e casella firma per Housekeeping.",
      icon: Sparkles,
      accent: "from-emerald-500 to-teal-500",
    },
    {
      href: `/stampa/in-casa`,
      title: "Lista ospiti in casa",
      desc: "Tutti gli ospiti attualmente presenti con camera, telefono e check-out.",
      icon: LogOut,
      accent: "from-amber-500 to-orange-500",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 shadow-md">
          <Printer className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Stampe rapide
          </h1>
          <p className="text-sm text-slate-500">
            Fogli A4 pronti per reception e pulizie. Cliccando si apre la
            versione stampabile — usa <kbd className="rounded border border-slate-200 bg-slate-100 px-1 py-0.5 text-xs font-bold">Cmd+P</kbd>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <Link
              key={c.href}
              href={c.href}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${c.accent}`} />
              <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${c.accent} shadow-md`}>
                <Icon className="h-5 w-5 text-white" />
              </div>
              <h2 className="text-base font-bold text-slate-900">{c.title}</h2>
              <p className="mt-1 text-xs text-slate-500">{c.desc}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
