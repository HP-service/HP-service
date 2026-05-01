"use client"

import { Printer, ArrowLeft } from "lucide-react"
import Link from "next/link"

export function PrintFrame({
  title,
  subtitle,
  property,
  children,
}: {
  title: string
  subtitle: string
  property: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-4">
      {/* Toolbar — non viene stampata */}
      <div className="flex items-center gap-2 print:hidden">
        <Link
          href="/stampa"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Stampe
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-200 hover:bg-indigo-700"
        >
          <Printer className="h-3.5 w-3.5" />
          Stampa
        </button>
      </div>

      {/* Foglio A4 */}
      <div className="mx-auto rounded-2xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="mb-6 flex items-end justify-between border-b-2 border-slate-900 pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
              {property}
            </p>
            <h1 className="text-2xl font-extrabold text-slate-900">{title}</h1>
            <p className="text-xs text-slate-600">{subtitle}</p>
          </div>
          <div className="text-right text-[10px] text-slate-500">
            <p>Stampato: {new Date().toLocaleString("it-IT")}</p>
          </div>
        </header>

        {children}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  )
}
