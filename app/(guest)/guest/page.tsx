"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Hotel, LogIn } from "lucide-react"
import { Button } from "@ui/button"
import { Input } from "@ui/input"
import { Label } from "@ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@ui/card"
import { loginGuest } from "@db/queries/guest-portal"

export default function GuestLoginPage() {
  const router = useRouter()
  const [roomName, setRoomName] = useState("")
  const [accessCode, setAccessCode] = useState("")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    startTransition(async () => {
      const result = await loginGuest(roomName.trim(), accessCode.trim().toUpperCase())
      if (result.error) {
        setError(result.error)
      } else {
        router.push("/guest/home")
      }
    })
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-blue-100">
            <Hotel className="h-7 w-7 text-blue-600" />
          </div>
          <CardTitle className="text-xl">Benvenuto</CardTitle>
          <CardDescription>
            Inserisci il numero della tua camera e il codice di accesso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="room">Camera</Label>
              <Input
                id="room"
                placeholder="Es: 101"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Codice accesso</Label>
              <Input
                id="code"
                placeholder="Es: ABC123"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                maxLength={6}
                required
                autoComplete="off"
                className="font-mono tracking-widest text-center text-lg"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={isPending}>
              {isPending ? "Accesso..." : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Accedi
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
