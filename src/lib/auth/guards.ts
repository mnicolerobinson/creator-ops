import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  const ctx = await requireUser();
  if (!["superadmin", "operator"].includes(ctx.profile?.role ?? "")) {
    redirect("/portal");
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
