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
    .from("profiles")
    .select("role, creator_id")
    .eq("id", user.id)
    .single();

  return { user, profile, supabase };
}

export async function requireOps() {
  const ctx = await requireUser();
  if (ctx.profile?.role !== "ops") {
    redirect("/portal");
  }
  return ctx;
}

export async function requireCreator() {
  const ctx = await requireUser();
  if (ctx.profile?.role !== "creator") {
    redirect("/ops");
  }
  return ctx;
}
