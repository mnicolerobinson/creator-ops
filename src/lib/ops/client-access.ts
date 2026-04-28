import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeRole } from "@/lib/auth/guards";

/** null = superadmin (all clients); empty array = no access; non-empty = filter to these ids */
export async function getOpsAllowedClientIds(
  supabase: SupabaseClient,
  userId: string,
  role: string | null | undefined,
): Promise<string[] | null> {
  if (normalizeRole(role) === "superadmin") return null;
  const { data } = await supabase
    .from("user_clients")
    .select("client_id")
    .eq("user_id", userId);
  return (data ?? []).map((row) => row.client_id);
}
