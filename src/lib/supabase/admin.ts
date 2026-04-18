import { createClient } from "@supabase/supabase-js";
import { getEnv, getServiceRoleKey } from "@/lib/env";

/**
 * Service-role client for workers, webhooks, and server-only mutations.
 * Bypasses RLS — use only in trusted server code.
 */
export function createAdminClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, getServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
