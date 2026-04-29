import { cookies } from "next/headers"
import { createAdminClient } from "@/lib/supabase/admin"
import { streamChat, type ChatMessage, type AIProvider } from "@ai/chat-client"

export const runtime = "nodejs"

type PortalSettings = {
  ai_enabled?: boolean
  ai_provider?: AIProvider
  ai_api_key?: string
  ai_model?: string
  ai_schedule_start?: string
  ai_schedule_end?: string
  ai_knowledge_base?: string
  ai_personality?: string
  portal_whatsapp_number?: string
  portal_wifi_network?: string
  portal_wifi_password?: string
}

export async function POST(req: Request) {
  try {
    // 1. Validate guest session
    const cookieStore = await cookies()
    const raw = cookieStore.get("hotel_guest_session")?.value
    if (!raw) {
      return Response.json({ error: "Non autenticato" }, { status: 401 })
    }

    let session: {
      booking_id: string
      property_id: string
      room_name: string
      guest_name: string
    }
    try {
      session = JSON.parse(raw)
    } catch {
      return Response.json({ error: "Sessione non valida" }, { status: 401 })
    }
    if (!session?.booking_id || !session?.property_id) {
      return Response.json({ error: "Sessione incompleta" }, { status: 401 })
    }

    // 2. Read AI settings
    // Admin client: l'ospite usa una cookie-session custom, non Supabase Auth,
    // quindi il client anonimo sarebbe bloccato dalle policy RLS su `properties`.
    const supabase = createAdminClient()
    const { data: property, error: propertyErr } = await supabase
      .from("properties")
      .select("name, settings, check_out_time")
      .eq("id", session.property_id)
      .single()

    if (propertyErr) {
      console.error("[guest-chat] property read error", { propertyId: session.property_id, err: propertyErr })
      return Response.json(
        { error: `Errore lettura struttura (${propertyErr.code}): ${propertyErr.message}` },
        { status: 500 }
      )
    }
    if (!property) {
      console.error("[guest-chat] property not found", { propertyId: session.property_id, bookingId: session.booking_id })
      return Response.json(
        { error: `Struttura non trovata (property_id: ${session.property_id?.slice(0, 8) ?? "vuoto"}...). Prova a fare logout e rifare login al portale ospite.` },
        { status: 404 }
      )
    }

    const settings = (property.settings ?? {}) as PortalSettings

    // Errori dettagliati per diagnosi rapida
    if (!settings.ai_enabled) {
      return Response.json(
        { error: "Segreteria AI non attiva. Vai in Impostazioni → Portale Ospiti e attiva 'Segreteria AI'." },
        { status: 503 }
      )
    }
    if (!settings.ai_provider) {
      return Response.json(
        { error: "Provider AI non selezionato (OpenAI/Anthropic/Google)." },
        { status: 503 }
      )
    }
    if (!settings.ai_api_key) {
      return Response.json(
        { error: "API Key AI mancante. Inseriscila in Impostazioni → Portale Ospiti." },
        { status: 503 }
      )
    }
    if (settings.ai_api_key.trim().length < 20) {
      return Response.json(
        { error: "API Key AI sembra non valida (troppo corta). Ricontrollala." },
        { status: 503 }
      )
    }

    // 3. Check schedule
    const now = new Date()
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    const start = settings.ai_schedule_start ?? "00:00"
    const end = settings.ai_schedule_end ?? "23:59"
    const isWithinSchedule = start <= end
      ? currentTime >= start && currentTime <= end
      : currentTime >= start || currentTime <= end

    // 4. Get services & attractions for context
    const [servicesRes, attractionsRes] = await Promise.all([
      supabase
        .from("portal_services")
        .select("name, description, price, category")
        .eq("property_id", session.property_id)
        .eq("is_active", true),
      supabase
        .from("portal_attractions")
        .select("name, description, category, external_url")
        .eq("property_id", session.property_id)
        .eq("is_active", true),
    ])

    // 5. Build system prompt
    const servicesCtx = (servicesRes.data ?? [])
      .map((s) => `- ${s.name}${s.price ? ` (€${s.price})` : ""}: ${s.description ?? ""}`)
      .join("\n")

    const attractionsCtx = (attractionsRes.data ?? [])
      .map((a) => `- ${a.name} [${a.category}]: ${a.description ?? ""}${a.external_url ? ` (link: ${a.external_url})` : ""}`)
      .join("\n")

    const personality = settings.ai_personality ?? "cordiale, professionale e conciso"

    let systemPrompt = `Sei il concierge virtuale dell'hotel "${property.name}". Rispondi in italiano.
Personalità: ${personality}.
Rispondi SOLO su argomenti relativi all'hotel, ai servizi offerti, alla zona circostante e alle informazioni turistiche.
Se la domanda non riguarda questi argomenti, rispondi gentilmente che puoi aiutare solo con informazioni sull'hotel e la zona.
Sii conciso: risposte brevi e utili.

L'ospite si chiama ${session.guest_name} ed è nella camera ${session.room_name}.
Check-out: ${property.check_out_time ?? "11:00"}.`

    if (settings.ai_knowledge_base) {
      systemPrompt += `\n\nInformazioni sull'hotel:\n${settings.ai_knowledge_base}`
    }

    if (settings.portal_wifi_network) {
      systemPrompt += `\n\nWiFi: rete "${settings.portal_wifi_network}"${settings.portal_wifi_password ? `, password: ${settings.portal_wifi_password}` : ""}`
    }

    if (settings.portal_whatsapp_number) {
      systemPrompt += `\n\nPer richieste urgenti o prenotazioni, l'ospite può contattare la reception su WhatsApp: ${settings.portal_whatsapp_number}`
    }

    if (servicesCtx) {
      systemPrompt += `\n\nServizi disponibili:\n${servicesCtx}`
    }

    if (attractionsCtx) {
      systemPrompt += `\n\nAttrazioni e info zona:\n${attractionsCtx}`
    }

    if (!isWithinSchedule) {
      systemPrompt += `\n\nATTENZIONE: La reception è attualmente chiusa (orario segreteria: ${start}-${end}). Aggiungi in ogni risposta una nota: "La reception confermerà appena disponibile."`
    }

    // 6. Parse user messages
    const body = await req.json()
    const userMessages: ChatMessage[] = body.messages ?? []

    const allMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...userMessages.slice(-20), // max 20 messages to limit cost
    ]

    // 7. Stream response
    const model = settings.ai_model ?? "gpt-4o-mini"
    const stream = streamChat(settings.ai_provider, settings.ai_api_key, model, allMessages, 2000)

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`))
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch (err) {
          // Log completo nei Vercel Runtime Logs
          console.error("[guest-chat] stream error", err)
          // Messaggio leggibile per il client
          const raw = err instanceof Error ? err.message : String(err)
          let friendly = raw
          if (raw.includes("401")) friendly = "API Key non valida o scaduta. Controlla la chiave in Impostazioni → Portale Ospiti."
          else if (raw.includes("429")) friendly = "Limite OpenAI raggiunto o credito esaurito. Verifica il tuo piano OpenAI."
          else if (raw.includes("insufficient_quota")) friendly = "Credito OpenAI esaurito. Ricarica il tuo account OpenAI."
          else if (raw.includes("model_not_found")) friendly = "Modello non disponibile per il tuo account OpenAI."
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: friendly })}\n\n`)
          )
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
