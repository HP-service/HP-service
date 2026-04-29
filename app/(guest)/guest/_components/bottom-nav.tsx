"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Compass, Info, MessageCircle, Sparkles } from "lucide-react"
import { cn } from "@utils/cn"

const tabs = [
  { name: "Home", href: "/guest/home", icon: Home },
  { name: "Servizi", href: "/guest/services", icon: Sparkles },
  { name: "Esplora", href: "/guest/explore", icon: Compass },
  { name: "Info", href: "/guest/info", icon: Info },
  { name: "Concierge", href: "/guest/concierge", icon: MessageCircle },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 pb-safe">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-2 text-xs transition-colors",
                isActive
                  ? "text-blue-600"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <tab.icon className={cn("h-5 w-5", isActive && "fill-blue-100")} />
              <span className="font-medium">{tab.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
