/**
 * Multi-provider AI chat client using raw fetch (zero dependencies).
 * Supports OpenAI, Anthropic, and Google Gemini with streaming.
 */

export interface ChatMessage {
  role: "user" | "assistant" | "system"
  content: string
}

export type AIProvider = "openai" | "anthropic" | "google"

// ── Streaming Chat ──────────────────────────────────

export async function* streamChat(
  provider: AIProvider,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number = 2000
): AsyncGenerator<string> {
  switch (provider) {
    case "openai":
      yield* streamOpenAI(apiKey, model, messages, maxTokens)
      break
    case "anthropic":
      yield* streamAnthropic(apiKey, model, messages, maxTokens)
      break
    case "google":
      yield* streamGoogle(apiKey, model, messages, maxTokens)
      break
  }
}

// ── OpenAI ──────────────────────────────────

async function* streamOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): AsyncGenerator<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      stream: true,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI error ${res.status}: ${err}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop()!

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data: ")) continue
      const data = trimmed.slice(6)
      if (data === "[DONE]") return

      try {
        const parsed = JSON.parse(data)
        const content = parsed.choices?.[0]?.delta?.content
        if (content) yield content
      } catch {
        // skip malformed JSON
      }
    }
  }
}

// ── Anthropic ──────────────────────────────────

async function* streamAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): AsyncGenerator<string> {
  // Separate system message from conversation
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? ""
  const conversationMsgs = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }))

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      system: systemMsg,
      messages: conversationMsgs,
      max_tokens: maxTokens,
      stream: true,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Anthropic error ${res.status}: ${err}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop()!

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data: ")) continue
      const data = trimmed.slice(6)

      try {
        const parsed = JSON.parse(data)
        if (parsed.type === "content_block_delta" && parsed.delta?.text) {
          yield parsed.delta.text
        }
      } catch {
        // skip
      }
    }
  }
}

// ── Google Gemini ──────────────────────────────────

async function* streamGoogle(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): AsyncGenerator<string> {
  // Convert to Gemini format
  const systemMsg = messages.find((m) => m.role === "system")?.content
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }))

  const body: Record<string, unknown> = {
    contents,
    generationConfig: { maxOutputTokens: maxTokens },
  }
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg }] }
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  )

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google error ${res.status}: ${err}`)
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop()!

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data: ")) continue
      const data = trimmed.slice(6)

      try {
        const parsed = JSON.parse(data)
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text
        if (text) yield text
      } catch {
        // skip
      }
    }
  }
}

// ── Default Models ──────────────────────────────────

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5-20251001",
  google: "gemini-2.0-flash",
}

export const PROVIDER_LABELS: Record<AIProvider, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic (Claude)",
  google: "Google (Gemini)",
}

export const MODEL_OPTIONS: Record<AIProvider, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-4o-mini", label: "GPT-4o Mini (economico)" },
    { value: "gpt-4o", label: "GPT-4o (premium)" },
  ],
  anthropic: [
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 (economico)" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6 (premium)" },
  ],
  google: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash (economico)" },
    { value: "gemini-2.0-pro", label: "Gemini 2.0 Pro (premium)" },
  ],
}
