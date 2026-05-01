export const dynamic = "force-dynamic"

import { requireRole, MAIN_APP_ROLES } from "@auth/index"
import { listTemplates } from "./_actions"
import { MessagesClient } from "./_components/client"

export default async function MessaggiPage() {
  await requireRole(MAIN_APP_ROLES)
  const result = await listTemplates()
  const templates = result.data ?? []

  return <MessagesClient templates={templates} />
}
