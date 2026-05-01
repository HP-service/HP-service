"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { success, failure, type ActionResult } from "@utils/errors"

export type MessageTemplate = {
  id: string
  property_id: string
  name: string
  kind: "PreArrival" | "PostCheckout" | "Welcome" | "Custom"
  channel: "Email" | "WhatsApp" | "SMS"
  subject: string | null
  body: string
  is_default: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

export async function listTemplates(): Promise<ActionResult<MessageTemplate[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .eq("is_active", true)
    .order("kind")
    .order("name")
  if (error) return failure(error.message)
  return success((data ?? []) as MessageTemplate[])
}

export async function getTemplate(id: string): Promise<ActionResult<MessageTemplate>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("message_templates")
    .select("*")
    .eq("id", id)
    .single()
  if (error) return failure(error.message)
  return success(data as MessageTemplate)
}

export async function upsertTemplate(values: {
  id?: string
  name: string
  kind: MessageTemplate["kind"]
  channel: MessageTemplate["channel"]
  subject?: string | null
  body: string
}): Promise<ActionResult<MessageTemplate>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return failure("Non autenticato")

  const { data: profile } = await supabase
    .from("profiles")
    .select("property_id")
    .eq("id", user.id)
    .single()
  if (!profile?.property_id) return failure("Property non trovata")

  if (values.id) {
    const { data, error } = await supabase
      .from("message_templates")
      .update({
        name: values.name,
        kind: values.kind,
        channel: values.channel,
        subject: values.subject ?? null,
        body: values.body,
      })
      .eq("id", values.id)
      .select()
      .single()
    if (error) return failure(error.message)
    revalidatePath("/messaggi")
    return success(data as MessageTemplate)
  }

  const { data, error } = await supabase
    .from("message_templates")
    .insert({
      property_id: profile.property_id,
      name: values.name,
      kind: values.kind,
      channel: values.channel,
      subject: values.subject ?? null,
      body: values.body,
    })
    .select()
    .single()
  if (error) return failure(error.message)
  revalidatePath("/messaggi")
  return success(data as MessageTemplate)
}

export async function deleteTemplate(id: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from("message_templates").delete().eq("id", id)
  if (error) return failure(error.message)
  revalidatePath("/messaggi")
  return success(undefined)
}

// Seed predefined templates for the property (idempotent: skips existing)
export async function seedDefaultTemplates(): Promise<ActionResult<number>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return failure("Non autenticato")

  const { data: profile } = await supabase
    .from("profiles")
    .select("property_id")
    .eq("id", user.id)
    .single()
  if (!profile?.property_id) return failure("Property non trovata")

  const { data: existing } = await supabase
    .from("message_templates")
    .select("name")
    .eq("property_id", profile.property_id)

  const existingNames = new Set((existing ?? []).map((t) => t.name))

  const toInsert = DEFAULT_TEMPLATES.filter((t) => !existingNames.has(t.name)).map((t) => ({
    property_id: profile.property_id,
    ...t,
  }))

  if (toInsert.length === 0) return success(0)

  const { error } = await supabase.from("message_templates").insert(toInsert)
  if (error) return failure(error.message)
  revalidatePath("/messaggi")
  return success(toInsert.length)
}

// ============================================================================
// Variable substitution
// ============================================================================

export type TemplateVars = {
  guest_name?: string
  property_name?: string
  property_address?: string
  property_phone?: string
  check_in?: string
  check_out?: string
  check_in_time?: string
  check_out_time?: string
  booking_number?: string
  precheckin_link?: string
  access_code?: string
  total_amount?: string
  nights?: string
}

export function substituteVars(text: string, vars: TemplateVars): string {
  let out = text
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined || value === null) continue
    out = out.replaceAll(`{{${key}}}`, String(value))
  }
  // Replace any remaining unmatched placeholders with empty string for cleanliness
  return out.replace(/\{\{[a-z_]+\}\}/g, "")
}

// ============================================================================
// Default templates
// ============================================================================

const DEFAULT_TEMPLATES = [
  {
    name: "Pre-arrivo: pre check-in digitale",
    kind: "PreArrival" as const,
    channel: "Email" as const,
    subject: "Benvenuto a {{property_name}} — Pre check-in online",
    body: `Ciao {{guest_name}},

grazie per aver scelto {{property_name}}! Il tuo check-in è previsto per il {{check_in}} (dalle {{check_in_time}}).

Per velocizzare l'arrivo, ti chiediamo di completare il pre check-in online cliccando sul link qui sotto. Bastano 2 minuti:

{{precheckin_link}}

Cosa devi avere a portata di mano:
• Documento d'identità valido (carta d'identità, passaporto o patente)
• Numero di telefono attivo

Ti aspettiamo!
{{property_name}}
{{property_address}}
{{property_phone}}`,
    is_default: true,
  },
  {
    name: "WhatsApp pre-arrivo veloce",
    kind: "PreArrival" as const,
    channel: "WhatsApp" as const,
    subject: null,
    body: `Ciao {{guest_name}}! 👋

Ti aspettiamo il {{check_in}} a {{property_name}}.

Per velocizzare il check-in, completa il pre check-in online qui: {{precheckin_link}}

A presto!`,
    is_default: false,
  },
  {
    name: "Welcome: codice accesso camera",
    kind: "Welcome" as const,
    channel: "Email" as const,
    subject: "Il tuo codice di accesso a {{property_name}}",
    body: `Ciao {{guest_name}},

benvenuto a {{property_name}}! 🎉

Il tuo codice di accesso personale è: {{access_code}}

Usalo per accedere alla tua camera e alle aree comuni. Conservalo per tutta la durata del soggiorno.

Per qualsiasi necessità, siamo a tua disposizione.

Buon soggiorno!
{{property_name}}`,
    is_default: false,
  },
  {
    name: "Post-checkout: ringraziamento + recensione",
    kind: "PostCheckout" as const,
    channel: "Email" as const,
    subject: "Grazie per aver soggiornato a {{property_name}}!",
    body: `Ciao {{guest_name}},

grazie per averci scelto! Speriamo che il tuo soggiorno presso {{property_name}} ({{check_in}} → {{check_out}}, {{nights}} notti) sia stato indimenticabile.

Se hai un minuto, ci farebbe enormemente piacere ricevere una tua recensione su Google o sulla piattaforma da cui hai prenotato. Le tue parole aiutano altri viaggiatori a scegliere e ci aiutano a migliorare ogni giorno.

Speriamo di rivederti presto!
{{property_name}}
{{property_phone}}`,
    is_default: true,
  },
  {
    name: "Conferma prenotazione",
    kind: "Custom" as const,
    channel: "Email" as const,
    subject: "Conferma prenotazione {{booking_number}} — {{property_name}}",
    body: `Ciao {{guest_name}},

la tua prenotazione è confermata! ✓

📅 Check-in: {{check_in}} (dalle {{check_in_time}})
📅 Check-out: {{check_out}} (entro le {{check_out_time}})
🛏 Notti: {{nights}}
💶 Totale: € {{total_amount}}
🏷 Numero prenotazione: {{booking_number}}

Indirizzo struttura:
{{property_address}}

Per qualsiasi necessità: {{property_phone}}

A presto!
{{property_name}}`,
    is_default: false,
  },
]
