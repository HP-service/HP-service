import type { BookingStatus } from "@db/enums"

/**
 * Booking State Machine
 *
 * Inquiry → Confirmed → CheckedIn → CheckedOut (terminale)
 *                    → Cancelled (terminale)
 *                    → NoShow (terminale)
 */

const TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  Inquiry: ["Confirmed", "Cancelled"],
  Confirmed: ["CheckedIn", "Cancelled", "NoShow"],
  CheckedIn: ["CheckedOut"],
  CheckedOut: [], // terminale
  Cancelled: [], // terminale
  NoShow: [], // terminale
}

export function canTransition(
  from: BookingStatus,
  to: BookingStatus
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function getAvailableTransitions(
  current: BookingStatus
): BookingStatus[] {
  return TRANSITIONS[current] ?? []
}

export function isTerminalStatus(status: BookingStatus): boolean {
  return TRANSITIONS[status]?.length === 0
}

export function getRequiredFieldsForTransition(
  to: BookingStatus
): string[] {
  switch (to) {
    case "CheckedIn":
      return ["room_id"] // deve avere camera assegnata
    case "Cancelled":
      return ["cancellation_reason"]
    default:
      return []
  }
}

export function getStatusLabel(status: BookingStatus): string {
  const labels: Record<BookingStatus, string> = {
    Inquiry: "Richiesta",
    Confirmed: "Confermata",
    CheckedIn: "Check-in",
    CheckedOut: "Check-out",
    Cancelled: "Cancellata",
    NoShow: "No-show",
  }
  return labels[status]
}

export function getStatusColor(status: BookingStatus): string {
  const colors: Record<BookingStatus, string> = {
    Inquiry: "bg-yellow-100 text-yellow-800",
    Confirmed: "bg-indigo-100 text-indigo-800",
    CheckedIn: "bg-green-100 text-green-800",
    CheckedOut: "bg-slate-100 text-slate-800",
    Cancelled: "bg-red-100 text-red-800",
    NoShow: "bg-orange-100 text-orange-800",
  }
  return colors[status]
}
