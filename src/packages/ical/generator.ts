/**
 * iCal (.ics) generator — RFC 5545
 * Generates VCALENDAR with VEVENT for each booking on a room.
 */

export type BookingEvent = {
  uid: string
  checkIn: string   // YYYY-MM-DD
  checkOut: string   // YYYY-MM-DD
  summary?: string
  created?: string   // ISO datetime
}

/** Escape special chars per RFC 5545 */
function escapeIcal(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n")
}

/** Format date as iCal DATE value (YYYYMMDD) */
function formatDate(iso: string): string {
  return iso.replace(/-/g, "")
}

/** Generate DTSTAMP in UTC */
function dtstamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
}

/**
 * Generate a complete .ics calendar for a single room.
 */
export function generateIcal(
  roomName: string,
  propertyName: string,
  events: BookingEvent[]
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HotelPMS//iCal Export//IT",
    `X-WR-CALNAME:${escapeIcal(propertyName)} - ${escapeIcal(roomName)}`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]

  for (const ev of events) {
    lines.push("BEGIN:VEVENT")
    lines.push(`UID:${ev.uid}`)
    lines.push(`DTSTAMP:${dtstamp()}`)
    lines.push(`DTSTART;VALUE=DATE:${formatDate(ev.checkIn)}`)
    lines.push(`DTEND;VALUE=DATE:${formatDate(ev.checkOut)}`)
    lines.push(`SUMMARY:${escapeIcal(ev.summary ?? "Occupato")}`)
    lines.push("TRANSP:OPAQUE")
    lines.push("STATUS:CONFIRMED")
    lines.push("END:VEVENT")
  }

  lines.push("END:VCALENDAR")

  // RFC 5545: lines terminated by CRLF
  return lines.join("\r\n") + "\r\n"
}

/**
 * Generate a combined .ics calendar with all rooms (global export).
 * Each event includes the room name in the summary.
 */
export function generateIcalAll(
  propertyName: string,
  roomEvents: Array<{ roomName: string; events: BookingEvent[] }>
): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HotelPMS//iCal Export//IT",
    `X-WR-CALNAME:${escapeIcal(propertyName)} - Tutte le camere`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ]

  for (const { roomName, events } of roomEvents) {
    for (const ev of events) {
      lines.push("BEGIN:VEVENT")
      lines.push(`UID:${ev.uid}`)
      lines.push(`DTSTAMP:${dtstamp()}`)
      lines.push(`DTSTART;VALUE=DATE:${formatDate(ev.checkIn)}`)
      lines.push(`DTEND;VALUE=DATE:${formatDate(ev.checkOut)}`)
      lines.push(`SUMMARY:${escapeIcal(roomName)} - ${escapeIcal(ev.summary ?? "Occupato")}`)
      lines.push("TRANSP:OPAQUE")
      lines.push("STATUS:CONFIRMED")
      lines.push("END:VEVENT")
    }
  }

  lines.push("END:VCALENDAR")
  return lines.join("\r\n") + "\r\n"
}
