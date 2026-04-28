import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/** TEMPORARY: set false and remove ops layout debug branch before production. */
export const TEMPORARY_OPS_AUTH_DEBUG = true;

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

  console.log("User ID:", user?.id);
  console.log("Profile from DB:", JSON.stringify(profile));
  console.log("Role:", profile?.role);

  const opsAllowed = !!profile && ["superadmin", "operator"].includes(profile.role);

  if (!opsAllowed) {
    if (TEMPORARY_OPS_AUTH_DEBUG) {
      return {
        user,
        profile,
        clientAccess,
        supabase,
        opsAuthFailed: true as const,
      };
    }
    redirect("/dashboard");
  }

  return { user, profile, clientAccess, supabase };
}

/** Ensure operator/superadmin may access this client row (RLS-aligned). */
export async function requireOpsClientAccess(clientId: string) {
  const ctx = await requireOps();
  if ("opsAuthFailed" in ctx && ctx.opsAuthFailed) {
    redirect("/ops");
  }
  if (ctx.profile?.role === "superadmin") {
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
  if (["superadmin", "operator"].includes(ctx.profile?.role ?? "")) {
    redirect("/ops");
  }
  if (!ctx.clientAccess?.client_id) {
    redirect("/login?error=auth");
  }
  return ctx;
}
