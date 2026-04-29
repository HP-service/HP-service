"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@ui/card"
import { Badge } from "@ui/badge"
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send, User, Users, ClipboardCheck } from "lucide-react"
import { PrimaryGuestForm, type PrimaryGuestData } from "./primary-guest-form"
import { AccompagnatoriList, type AccompagnatoreData } from "./accompagnatori-list"
import { ReviewSummary } from "./review-summary"
import {
  updateGuestAlloggiatiFields,
  saveBookingGuests,
  testCheckInSchedine,
  completeCheckIn,
} from "@db/queries/checkin"
import { TIPO_ALLOGGIATO } from "@alloggiati/types"

type Props = {
  booking: Record<string, unknown>
  existingBookingGuests: Array<Record<string, unknown>>
  existingSubmissions: Array<Record<string, unknown>>
  hasCredentials: boolean
}

const STEPS = [
  { id: 1, label: "Ospite", icon: User },
  { id: 2, label: "Accompagnatori", icon: Users },
  { id: 3, label: "Verifica", icon: ClipboardCheck },
  { id: 4, label: "Invio", icon: Send },
]

export function CheckInWizard({ booking, existingBookingGuests, existingSubmissions, hasCredentials }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStep, setCurrentStep] = useState(1)

  // Dati form
  const guest = booking.guest as Record<string, unknown> | null
  const [primaryData, setPrimaryData] = useState<PrimaryGuestData | null>(null)
  const [accompagnatori, setAccompagnatori] = useState<AccompagnatoreData[]>([])
  const [testResult, setTestResult] = useState<{
    schedineValide: number
    totale: number
    errori: Array<{ riga: number; errore: string }>
  } | null>(null)
  const [sendComplete, setSendComplete] = useState(false)
  const [sendErrors, setSendErrors] = useState<string[]>([])

  // Determina tipo alloggiato
  const guestType = accompagnatori.length > 0 ? TIPO_ALLOGGIATO.CAPO_FAMIGLIA : TIPO_ALLOGGIATO.OSPITE_SINGOLO

  // ── Step navigation ──────────────────────────

  function goNext() {
    if (currentStep === 1 && !primaryData) {
      toast.error("Compila i dati dell'ospite principale")
      return
    }
    setCurrentStep((s) => Math.min(s + 1, 4))
  }

  function goBack() {
    setCurrentStep((s) => Math.max(s - 1, 1))
  }

  // ── Step 3: Salva e testa ────────────────────

  async function handleSaveAndTest() {
    if (!primaryData || !guest) return

    startTransition(async () => {
      // 1. Aggiorna ospite principale nel DB
      const updateResult = await updateGuestAlloggiatiFields(guest.id as string, {
        first_name: primaryData.nome,
        last_name: primaryData.cognome,
        gender: primaryData.sesso,
        date_of_birth: primaryData.data_nascita,
        place_of_birth: primaryData.comune_nascita || "",
        province_of_birth: primaryData.provincia_nascita || undefined,
        country_of_birth: primaryData.stato_nascita,
        citizenship: primaryData.cittadinanza,
        document_type: primaryData.tipo_documento,
        document_number: primaryData.numero_documento,
        document_issued_by: primaryData.luogo_rilascio,
      })

      if (updateResult.error) {
        toast.error(updateResult.error)
        return
      }

      // 2. Salva booking_guests (ospite primario + accompagnatori)
      const accData = accompagnatori.map((a) => ({
        guest_id: a.guest_id,
        first_name: a.nome,
        last_name: a.cognome,
        gender: a.sesso,
        date_of_birth: a.data_nascita,
        place_of_birth: a.comune_nascita || "",
        province_of_birth: a.provincia_nascita || undefined,
        country_of_birth: a.stato_nascita,
        citizenship: a.cittadinanza,
        guest_type: a.guest_type as "19" | "20",
      }))

      const saveResult = await saveBookingGuests(
        booking.id as string,
        guest.id as string,
        guestType as "16" | "17" | "18",
        accData
      )

      if (saveResult.error) {
        toast.error(saveResult.error)
        return
      }

      // 3. Test schedine se credenziali configurate
      if (hasCredentials) {
        const testRes = await testCheckInSchedine(booking.id as string)
        if (testRes.error) {
          toast.error(testRes.error)
          return
        }
        if (testRes.data) {
          setTestResult(testRes.data)
          if (testRes.data.errori.length === 0) {
            toast.success(`Test superato: ${testRes.data.schedineValide} schedine valide`)
          } else {
            toast.warning(`${testRes.data.errori.length} errori trovati`)
          }
        }
      } else {
        toast.success("Dati salvati (credenziali Alloggiati non configurate)")
      }
    })
  }

  // ── Step 4: Invio reale + check-in ──────────

  async function handleSendAndCheckIn(skipAlloggiati: boolean) {
    startTransition(async () => {
      const result = await completeCheckIn(booking.id as string, { skipAlloggiati })

      if (result.error) {
        toast.error(result.error)
        return
      }

      if (result.data) {
        if (result.data.alloggiatiErrors && result.data.alloggiatiErrors.length > 0) {
          setSendErrors(result.data.alloggiatiErrors)
          toast.warning("Check-in completato con errori Alloggiati")
        } else {
          setSendComplete(true)
          toast.success(
            result.data.alloggiatiSent
              ? "Check-in completato e schedine inviate!"
              : "Check-in completato (senza invio Alloggiati)"
          )
        }

        // Redirect dopo 2 secondi
        setTimeout(() => {
          router.push(`/bookings/${booking.id}`)
          router.refresh()
        }, 2000)
      }
    })
  }

  // ── Render ───────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Step indicator — Figma style with icons */}
      <div className="flex items-center justify-center gap-0">
        {STEPS.map((step, i) => {
          const Icon = step.icon
          const isDone = step.id < currentStep
          const isActive = step.id === currentStep
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1.5">
                <button
                  onClick={() => step.id <= currentStep ? setCurrentStep(step.id) : undefined}
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    isDone
                      ? "bg-emerald-500 text-white cursor-pointer"
                      : isActive
                      ? "bg-primary text-white shadow-lg shadow-primary/30 scale-110"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {isDone ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </button>
                <span className={`text-[11px] font-semibold hidden sm:block ${
                  isActive ? "text-primary" : isDone ? "text-emerald-600" : "text-muted-foreground"
                }`}>{step.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 sm:w-16 h-0.5 mx-2 rounded-full mb-5 ${isDone ? "bg-emerald-400" : "bg-border"}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      {currentStep === 1 && (
        <PrimaryGuestForm
          guest={guest}
          initialData={primaryData}
          onSave={(data) => {
            setPrimaryData(data)
            goNext()
          }}
        />
      )}

      {currentStep === 2 && (
        <AccompagnatoriList
          accompagnatori={accompagnatori}
          onChange={setAccompagnatori}
          onNext={goNext}
          onBack={goBack}
        />
      )}

      {currentStep === 3 && primaryData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verifica dati</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ReviewSummary
              primary={primaryData}
              primaryType={guestType}
              accompagnatori={accompagnatori}
            />

            {testResult && (
              <div className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {testResult.errori.length === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  )}
                  <span className="font-medium">
                    Test: {testResult.schedineValide}/{testResult.totale} schedine valide
                  </span>
                </div>
                {testResult.errori.map((e, i) => (
                  <div key={i} className="text-sm text-destructive">
                    Riga {e.riga}: {e.errore}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" onClick={goBack}>
                <ChevronLeft className="mr-1 h-4 w-4" /> Indietro
              </Button>
              <Button onClick={handleSaveAndTest} disabled={isPending}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {hasCredentials ? "Salva e testa schedine" : "Salva dati"}
              </Button>
              {(testResult?.errori.length === 0 || !hasCredentials) && (
                <Button variant="default" onClick={goNext}>
                  Procedi all&apos;invio <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {currentStep === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Invio e Check-in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {sendComplete ? (
              <div className="flex items-center gap-3 rounded-lg bg-green-50 p-4 text-green-800">
                <CheckCircle2 className="h-6 w-6" />
                <div>
                  <p className="font-medium">Check-in completato!</p>
                  <p className="text-sm">Reindirizzamento in corso...</p>
                </div>
              </div>
            ) : (
              <>
                {sendErrors.length > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-1">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-medium">Errori durante l&apos;invio Alloggiati</span>
                    </div>
                    {sendErrors.map((e, i) => (
                      <p key={i} className="text-sm text-amber-700">{e}</p>
                    ))}
                  </div>
                )}

                {!hasCredentials && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                    <div className="flex items-center gap-2 text-amber-800">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-medium">Credenziali Alloggiati non configurate</span>
                    </div>
                    <p className="mt-1 text-sm text-amber-700">
                      Puoi completare il check-in senza invio. Configura le credenziali in Impostazioni.
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={goBack}>
                    <ChevronLeft className="mr-1 h-4 w-4" /> Indietro
                  </Button>

                  {hasCredentials && (
                    <Button onClick={() => handleSendAndCheckIn(false)} disabled={isPending}>
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      Invia ad Alloggiati e Check-in
                    </Button>
                  )}

                  <Button
                    variant="secondary"
                    onClick={() => handleSendAndCheckIn(true)}
                    disabled={isPending}
                  >
                    {isPending && !hasCredentials ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    {hasCredentials ? "Check-in senza invio" : "Completa Check-in"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
