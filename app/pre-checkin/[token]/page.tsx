export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { PreCheckinForm } from "./_form"
import { Building2, CheckCircle2 } from "lucide-react"

export default async function PreCheckinPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc("get_precheckin_booking", { p_token: token })
    .single()

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100">
          <Building2 className="h-6 w-6 text-rose-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Link non valido</h1>
        <p className="mt-2 text-sm text-slate-500">
          Questo link di pre check-in non è valido o è scaduto. Contatta la
          struttura per ricevere un nuovo link.
        </p>
      </div>
    )
  }

  const b = data as {
    property_name: string
    property_address: string | null
    property_city: string | null
    check_in: string
    check_out: string
    adults: number
    children: number
    booking_number: string
    completed: boolean
  }

  if (b.completed) {
    return (
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100">
          <CheckCircle2 className="h-7 w-7 text-emerald-600" />
        </div>
        <h1 className="text-xl font-bold text-slate-900">Pre check-in completato</h1>
        <p className="mt-2 text-sm text-slate-500">
          Hai già completato il pre check-in per la prenotazione{" "}
          <strong>{b.booking_number}</strong>. Ci vediamo in struttura!
        </p>
      </div>
    )
  }

  return <PreCheckinForm token={token} booking={b} />
}
