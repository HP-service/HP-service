"use client"

import { useState } from "react"
import { Menu, Bell, Building2 } from "lucide-react"
import { Sidebar } from "./sidebar"
import { TopBar } from "./_components/topbar"

export function MainShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar global */}
        <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-slate-200 bg-white/80 px-3 backdrop-blur-sm md:px-5">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 md:hidden"
            aria-label="Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600">
              <Building2 className="h-3.5 w-3.5 text-white" />
            </div>
          </div>

          <TopBar />

          <button
            className="hidden shrink-0 rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 sm:inline-flex"
            aria-label="Notifiche"
          >
            <Bell className="h-[18px] w-[18px]" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl p-4 md:p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  )
}
