export const dynamic = "force-dynamic"

import { getProfile, signOut } from "@auth/server"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { LogOut, Mail, Phone, Shield, UserCircle, Building2, MapPin } from "lucide-react"

export default async function ProfilePage() {
  const profile = await getProfile()
  if (!profile) redirect("/login")

  const supabase = await createClient()
  const { data: property } = profile.property_id
    ? await supabase
        .from("properties")
        .select("name, address, city, postal_code, province, vat_number, cin_code")
        .eq("id", profile.property_id)
        .single()
    : { data: null }

  const initials = (profile.full_name || profile.email || "?")
    .split(/\s+/)
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Il mio profilo</h1>
        <p className="text-sm text-slate-500 mt-0.5">Dati personali e struttura collegata</p>
      </div>

      {/* User card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-xl font-extrabold text-white shadow-lg shadow-indigo-200">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-slate-900 truncate">{profile.full_name}</h2>
            <p className="text-sm text-slate-500 truncate">{profile.email}</p>
          </div>
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
            {profile.role}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field icon={<Mail className="h-4 w-4 text-slate-400" />} label="Email" value={profile.email} />
          <Field icon={<Phone className="h-4 w-4 text-slate-400" />} label="Telefono" value={profile.phone || "—"} />
          <Field
            icon={<Shield className="h-4 w-4 text-slate-400" />}
            label="Ruolo"
            value={profile.role}
          />
          <Field
            icon={<UserCircle className="h-4 w-4 text-slate-400" />}
            label="Stato"
            value={profile.is_active ? "Attivo" : "Disattivato"}
          />
        </div>
      </div>

      {/* Property card */}
      {property ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{property.name}</h2>
              <p className="text-xs text-slate-500">La tua struttura</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              icon={<MapPin className="h-4 w-4 text-slate-400" />}
              label="Indirizzo"
              value={
                property.address
                  ? `${property.address}, ${property.postal_code ?? ""} ${property.city ?? ""}${
                      property.province ? ` (${property.province})` : ""
                    }`
                  : "—"
              }
            />
            <Field icon={<Shield className="h-4 w-4 text-slate-400" />} label="P.IVA" value={property.vat_number || "—"} />
            <Field icon={<Shield className="h-4 w-4 text-slate-400" />} label="CIN" value={property.cin_code || "—"} />
          </div>
        </div>
      ) : null}

      {/* Logout */}
      <form
        action={async () => {
          "use server"
          await signOut()
        }}
      >
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
        >
          <LogOut className="h-4 w-4" />
          Esci dall'account
        </button>
      </form>
    </div>
  )
}

function Field({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      </div>
      <p className="text-sm font-semibold text-slate-900 break-words">{value}</p>
    </div>
  )
}
