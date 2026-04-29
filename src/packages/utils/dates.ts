import { format, differenceInDays, parseISO, isValid } from "date-fns"
import { it } from "date-fns/locale"

export function formatDate(date: string | Date, pattern = "dd/MM/yyyy") {
  const d = typeof date === "string" ? parseISO(date) : date
  if (!isValid(d)) return "—"
  return format(d, pattern, { locale: it })
}

export function formatDateShort(date: string | Date) {
  return formatDate(date, "dd MMM")
}

export function formatDateTime(date: string | Date) {
  return formatDate(date, "dd/MM/yyyy HH:mm")
}

export function nightsBetween(checkIn: string | Date, checkOut: string | Date) {
  const start = typeof checkIn === "string" ? parseISO(checkIn) : checkIn
  const end = typeof checkOut === "string" ? parseISO(checkOut) : checkOut
  return differenceInDays(end, start)
}

export function toISODate(date: Date): string {
  return format(date, "yyyy-MM-dd")
}
