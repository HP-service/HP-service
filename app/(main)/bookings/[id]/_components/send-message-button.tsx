"use client"

import { useState } from "react"
import { Button } from "@ui/button"
import { Send } from "lucide-react"
import { ComposeDialog } from "@/app/(main)/messaggi/_components/client"
import type { MessageTemplate } from "@/app/(main)/messaggi/_actions"

export function SendMessageButton({
  templates,
  vars,
  guestEmail,
  guestPhone,
}: {
  templates: MessageTemplate[]
  vars: Record<string, string | undefined>
  guestEmail?: string | null
  guestPhone?: string | null
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Send className="h-3.5 w-3.5" />
        Invia messaggio
      </Button>
      <ComposeDialog
        open={open}
        onClose={() => setOpen(false)}
        templates={templates}
        vars={vars}
        guestEmail={guestEmail}
        guestPhone={guestPhone}
      />
    </>
  )
}
