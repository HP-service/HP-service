export const dynamic = "force-dynamic"

import Link from "next/link"
import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import { listInfoPages } from "./_actions"
import { InfoOspitiClient } from "./_components/client"

export default async function InfoOspitiPage() {
  await requireRole(MAIN_APP_ROLES)
  const res = await listInfoPages()
  const pages = res.ok ? res.data : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          Info Ospiti
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Crea pagine informative per i tuoi ospiti — orari, WiFi, regole, servizi.
          Le condividi con un link.
        </p>
      </div>

      <InfoOspitiClient initialPages={pages} />

      {res.ok ? null : (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {res.error}. Probabilmente devi eseguire{" "}
          <code className="rounded bg-white px-1 py-0.5 font-mono text-xs">
            supabase-info-ospiti.sql
          </code>{" "}
          su Supabase.{" "}
          <Link href="/dashboard" className="font-semibold underline">
            Torna alla dashboard
          </Link>
          .
        </div>
      )}
    </div>
  )
}
