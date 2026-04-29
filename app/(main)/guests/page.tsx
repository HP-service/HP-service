export const dynamic = "force-dynamic"

import { getGuests } from "@db/queries/guests"
import { requireRole } from "@auth/server"
import { MAIN_APP_ROLES } from "@auth/roles"
import { GuestsClient } from "./_components/guests-client"

export default async function GuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const profile = await requireRole(MAIN_APP_ROLES)
  const { q } = await searchParams
  const result = await getGuests(q)

  return (
    <GuestsClient
      guests={result.data ?? []}
      propertyId={profile.property_id!}
      error={result.error ?? undefined}
      initialSearch={q ?? ""}
    />
  )
}
