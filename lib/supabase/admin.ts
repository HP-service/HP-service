import { createClient } from "@supabase/supabase-js"

// Admin client - bypasses RLS
// ONLY use for: auth admin operations, cron jobs, webhooks
// NEVER use for regular data queries - use the anon client instead
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
