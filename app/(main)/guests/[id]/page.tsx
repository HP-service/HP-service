export const dynamic = "force-dynamic"

import Link from "next/link"
import { notFound } from "next/navigation"
import { getGuest, getGuestBookings } from "@db/queries/guests"
import { Badge } from "@ui/badge"
import { Button } from "@ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Separator } from "@ui/separator"
import { ArrowLeft, Mail, Phone, MapPin, FileText } from "lucide-react"
import { GuestEditForm } from "./_components/guest-edit-form"

export default async function GuestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!id) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let guestResult: any = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let bookingsResult: any = null
  try {
    const res = await Promise.all([getGuest(id), getGuestBookings(id)])
    guestResult = res[0]
    bookingsResult = res[1]
  } catch (err) {
    console.error("[GuestDetailPage] fetch error", err)
    notFound()
  }

  if (!guestResult || guestResult.error || !guestResult.data) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const guest = guestResult.data as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bookings = (bookingsResult?.data ?? []) as any[]
  if (!guest?.id || !guest?.full_name) notFound()

  const LOYALTY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
    Bronze: "outline",
    Silver: "secondary",
    Gold: "default",
    Platinum: "default",
  }

  const STATUS_LABELS: Record<string, string> = {
    Inquiry: "Richiesta",
    Confirmed: "Confermata",
    CheckedIn: "Check-in",
    CheckedOut: "Check-out",
    Cancelled: "Annullata",
    NoShow: "No Show",
  }

  const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
    Inquiry: "outline",
    Confirmed: "secondary",
    CheckedIn: "default",
    CheckedOut: "secondary",
    Cancelled: "destructive",
    NoShow: "destructive",
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/guests">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">{guest.full_name}</h1>
            {guest.loyalty_level && (
              <Badge variant={LOYALTY_VARIANTS[guest.loyalty_level] ?? "outline"}>
                {guest.loyalty_level}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {guest.total_stays ?? 0} soggiorni · €{Number(guest.total_revenue ?? 0).toFixed(0)} revenue totale
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: contact + edit form */}
        <div className="space-y-6 lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contatti</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {guest.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span>{guest.email}</span>
                </div>
              )}
              {guest.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span>{guest.phone}</span>
                </div>
              )}
              {(guest.city || guest.country) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span>{[guest.city, guest.country].filter(Boolean).join(", ")}</span>
                </div>
              )}
              {guest.nationality && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="text-xs font-medium uppercase">Naz.</span>
                  <span>{guest.nationality}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {(guest.document_type || guest.document_number) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Documento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{guest.document_type}</span>
                </div>
                {guest.document_number && (
                  <p className="text-muted-foreground ml-5">{guest.document_number}</p>
                )}
                {guest.document_expiry && (
                  <p className="text-xs text-muted-foreground ml-5">
                    Scade: {guest.document_expiry}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {guest.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{guest.notes}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Modifica dati</CardTitle>
            </CardHeader>
            <CardContent>
              <GuestEditForm guest={guest} />
            </CardContent>
          </Card>
        </div>

        {/* Right: booking history */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Storico prenotazioni ({bookings.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {bookings.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Nessuna prenotazione.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-4 py-3 text-left font-medium">Numero</th>
                      <th className="px-4 py-3 text-left font-medium">Date</th>
                      <th className="px-4 py-3 text-left font-medium">Tipo / Camera</th>
                      <th className="px-4 py-3 text-right font-medium">Importo</th>
                      <th className="px-4 py-3 text-center font-medium">Stato</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((b) => {
                      const rtRaw = b.room_type
                      const rt = Array.isArray(rtRaw) ? rtRaw[0] : rtRaw
                      const rmRaw = b.room
                      const rm = Array.isArray(rmRaw) ? rmRaw[0] : rmRaw
                      const status = typeof b.status === "string" ? b.status : ""
                      return (
                      <tr
                        key={b.id}
                        className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                      >
                        <td className="px-4 py-3 font-medium">
                          {b.id ? (
                            <Link href={`/bookings/${b.id}`} className="hover:underline">
                              {b.booking_number ?? "—"}
                            </Link>
                          ) : (
                            <span>{b.booking_number ?? "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {b.check_in ?? "—"} → {b.check_out ?? "—"}
                          {b.nights != null && (
                            <span className="ml-1 text-xs">({b.nights}n)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div>{rt?.name ?? "—"}</div>
                          {rm?.name && (
                            <div className="text-xs text-muted-foreground">
                              Camera {rm.name}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          €{Number(b.total_amount ?? 0).toFixed(0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={STATUS_VARIANTS[status] ?? "outline"}>
                            {STATUS_LABELS[status] ?? status ?? "—"}
                          </Badge>
                        </td>
                      </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
