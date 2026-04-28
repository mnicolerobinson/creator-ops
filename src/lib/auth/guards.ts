import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** Normalize DB role text (handles stray whitespace / casing drift vs CHECK constraint). */
export function normalizeRole(role: string | null | undefined): string {
  return (role ?? "").trim().toLowerCase();
}

export function isOpsRole(role: string | null | undefined): boolean {
  const r = normalizeRole(role);
  return r === "superadmin" || r === "operator";
}

export async function requireUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const { data: clientAccess } = await supabase
    .from("user_clients")
    .select("client_id, access_level")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return { user, profile, clientAccess, supabase };
}

export async function requireOps() {
  noStore();
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileErr } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileErr) {
    console.error("[requireOps] user_profiles select failed:", profileErr.message);
  }

  if (!profile || !isOpsRole(profile.role)) {
    redirect("/dashboard");
  }

  const { data: clientAccess } = await supabase
    .from("user_clients")
    .select("client_id, access_level")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  return { user, profile, clientAccess, supabase };
}

/** Ensure operator/superadmin may access this client row (RLS-aligned). */
export async function requireOpsClientAccess(clientId: string) {
  const ctx = await requireOps();
  if (normalizeRole(ctx.profile?.role) === "superadmin") {
    return ctx;
  }
  const { data } = await ctx.supabase
    .from("user_clients")
    .select("client_id")
    .eq("user_id", ctx.user.id)
    .eq("client_id", clientId)
    .maybeSingle();
  if (!data) {
    redirect("/ops/clients");
  }
  return ctx;
}

/** Client portal: same access as /dashboard (linked user_clients row; not ops). */
export async function requireCreator() {
  const ctx = await requireUser();
  if (isOpsRole(ctx.profile?.role)) {
    redirect("/ops");
  }
  if (!ctx.clientAccess?.client_id) {
    redirect("/login?error=auth");
  }
  return ctx;
}
