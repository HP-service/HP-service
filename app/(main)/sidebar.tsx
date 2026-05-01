"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  LayoutDashboard,
  CalendarRange,
  BookOpen,
  BedDouble,
  KeyRound,
  Users,
  ShieldCheck,
  BarChart3,
  Receipt,
  TrendingUp,
  ReceiptText,
  FileSpreadsheet,
  RefreshCw,
  LineChart,
  MessageCircle,
  Settings,
  UserCircle,
  LogOut,
  X,
  Building2,
  Archive,
  Printer,
  Mail,
  Star,
  Wrench,
} from "lucide-react"
import { useSession } from "@auth/client"
import { signOut } from "@auth/server"
import { useTransition } from "react"

type Item = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string | number
}

type Group = { title: string; items: Item[] }

const GROUPS: Group[] = [
  {
    title: "Operativo",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/planning", label: "Planning", icon: CalendarRange },
      { href: "/bookings", label: "Prenotazioni", icon: BookOpen },
      { href: "/rooms", label: "Camere", icon: BedDouble },
      { href: "/check-in", label: "Check-in", icon: KeyRound },
      { href: "/stampa", label: "Stampe rapide", icon: Printer },
    ],
  },
  {
    title: "CRM",
    items: [{ href: "/guests", label: "Ospiti", icon: Users }],
  },
  {
    title: "Compliance",
    items: [
      { href: "/alloggiati", label: "Alloggiati Web", icon: ShieldCheck },
      { href: "/istat", label: "ISTAT", icon: BarChart3 },
      { href: "/tassa-soggiorno", label: "Tassa Soggiorno", icon: Receipt },
      { href: "/archivio", label: "Archivio Documenti", icon: Archive },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/finance", label: "Finanze", icon: TrendingUp },
      { href: "/finance/expenses", label: "Spese", icon: ReceiptText },
      { href: "/finance/export-clienti", label: "Export Fatture", icon: FileSpreadsheet },
    ],
  },
  {
    title: "Operations",
    items: [
      { href: "/ical", label: "iCal Sync", icon: RefreshCw },
      { href: "/scraping", label: "Competitor", icon: LineChart },
      { href: "/info-ospiti", label: "Info Ospiti", icon: MessageCircle },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/settings", label: "Impostazioni", icon: Settings },
      { href: "/profile", label: "Profilo", icon: UserCircle },
    ],
  },
]

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const { profile } = useSession()
  const [isPending, startTransition] = useTransition()

  const initials = (profile.full_name || profile.email)
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname === href || pathname?.startsWith(href + "/")
  }

  return (
    <>
      {/* mobile overlay */}
      {open ? (
        <div
          className="fixed inset-0 z-[700] bg-black/40 md:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-[750] flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between gap-2 px-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-slate-900">HP Service</div>
              <div className="text-[10px] font-medium text-slate-500">
                Gestionale strutture
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {GROUPS.map((group) => (
            <div key={group.title} className="mb-4">
              <div className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </div>
              {group.items.map((item) => {
                const active = isActive(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`group relative mb-0.5 flex items-center gap-2.5 rounded-r-lg border-l-2 py-2 pl-3 pr-3 text-[13px] font-medium transition-all ${
                      active
                        ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                        : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 transition-colors ${
                        active ? "text-indigo-600" : "text-slate-400 group-hover:text-slate-600"
                      }`}
                    />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-slate-50">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
                {initials || "?"}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-xs font-semibold text-slate-900">
                {profile.full_name || profile.email}
              </div>
              <div className="text-[10px] font-medium text-slate-500">{profile.role}</div>
            </div>
            <button
              type="button"
              onClick={() => startTransition(() => signOut())}
              disabled={isPending}
              title="Esci"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
