import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Portale Ospite",
  description: "Area riservata ospiti",
}

export default function GuestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {children}
    </div>
  )
}
