/**
 * iCal (.ics) parser — RFC 5545
 * Parses VCALENDAR and extracts VEVENT blocks with check-in/check-out dates.
 */

export type ParsedEvent = {
  uid: string
  dtstart: string   // YYYY-MM-DD
  dtend: string     // YYYY-MM-DD
  summary: string
  status: string    // CONFIRMED, TENTATIVE, CANCELLED
}

/** Parse iCal DATE or DATE-TIME to YYYY-MM-DD */
function parseIcalDate(raw: string): string {
  // Remove VALUE=DATE: prefix if present, handle TZID
  const clean = raw.replace(/^.*:/, "").trim()
  // YYYYMMDD or YYYYMMDDTHHmmssZ
  const y = clean.substring(0, 4)
  const m = clean.substring(4, 6)
  const d = clean.substring(6, 8)
  return `${y}-${m}-${d}`
}

/** Unescape RFC 5545 text */
function unescapeIcal(s: string): string {
  return s
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
}

/**
 * Parse an .ics string and extract all VEVENT blocks.
 * Returns parsed events sorted by dtstart.
 */
export function parseIcal(icsContent: string): ParsedEvent[] {
  const events: ParsedEvent[] = []

  // Unfold lines (RFC 5545: continuation lines start with space/tab)
  const unfolded = icsContent.replace(/\r?\n[ \t]/g, "")
  const lines = unfolded.split(/\r?\n/)

  let inEvent = false
  let uid = ""
  let dtstart = ""
  let dtend = ""
  let summary = ""
  let status = "CONFIRMED"

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true
      uid = ""
      dtstart = ""
      dtend = ""
      summary = "Occupato"
      status = "CONFIRMED"
      continue
    }

    if (line === "END:VEVENT") {
      inEvent = false
      if (dtstart && dtend) {
        events.push({
          uid: uid || `imported-${dtstart}-${dtend}-${Math.random().toString(36).slice(2, 8)}`,
          dtstart,
          dtend,
          summary: unescapeIcal(summary),
          status,
        })
      }
      continue
    }

    if (!inEvent) continue

    if (line.startsWith("UID:")) {
      uid = line.substring(4).trim()
    } else if (line.startsWith("DTSTART")) {
      dtstart = parseIcalDate(line)
    } else if (line.startsWith("DTEND")) {
      dtend = parseIcalDate(line)
    } else if (line.startsWith("SUMMARY:")) {
      summary = line.substring(8).trim()
    } else if (line.startsWith("STATUS:")) {
      status = line.substring(7).trim()
    }
  }

  return events.sort((a, b) => a.dtstart.localeCompare(b.dtstart))
}
