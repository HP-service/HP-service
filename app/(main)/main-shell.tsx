"use client"

import { useState } from "react"
import { Menu, Bell, Search, Building2 } from "lucide-react"
import { Sidebar } from "./sidebar"

export function MainShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white/80 px-4 backdrop-blur-sm md:hidden">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
                <Building2 className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-bold text-slate-900">HP Service</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100">
              <Search className="h-[18px] w-[18px]" />
            </button>
            <button className="relative rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
