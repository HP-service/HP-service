"use client"

import { MessageCircle } from "lucide-react"
import { Button } from "@ui/button"

type Props = {
  phoneNumber: string
  message: string
  label?: string
  className?: string
}

export function WhatsAppButton({ phoneNumber, message, label = "WhatsApp", className }: Props) {
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, "")
  const url = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(message)}`

  return (
    <Button
      variant="outline"
      className={className}
      asChild
    >
      <a href={url} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="mr-2 h-4 w-4 text-green-600" />
        {label}
      </a>
    </Button>
  )
}
