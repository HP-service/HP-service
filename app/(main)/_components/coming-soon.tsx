import { Lock } from "lucide-react"
import type { LucideIcon } from "lucide-react"

type Props = {
  icon: LucideIcon
  title: string
  description: string
  features?: string[]
}

export function ComingSoon({ icon: Icon, title, description, features }: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* Lock badge */}
      <div className="relative mb-6">
        <div className="w-20 h-20 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center">
          <Icon className="h-9 w-9 text-slate-400" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-amber-100 border-2 border-white flex items-center justify-center shadow-sm">
          <Lock className="h-3.5 w-3.5 text-amber-600" />
        </div>
      </div>

      {/* Badge */}
      <div className="mb-3">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-semibold">
          <Lock className="h-3 w-3" />
          Prossimamente
        </span>
      </div>

      {/* Title + desc */}
      <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
      <p className="text-muted-foreground text-sm max-w-md leading-relaxed">{description}</p>

      {/* Feature list */}
      {features && features.length > 0 && (
        <div className="mt-8 w-full max-w-sm bg-card border border-border rounded-2xl p-5 text-left shadow-sm">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
            In arrivo
          </p>
          <ul className="space-y-2">
            {features.map((f) => (
              <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
