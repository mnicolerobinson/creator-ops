import { createServerSupabaseClient } from "@/lib/supabase/server";

export type OnboardingPolicy = Record<string, unknown>;

export async function getOnboardingData(): Promise<{
  client: Record<string, unknown> | null;
  policy: OnboardingPolicy;
}> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { client: null, policy: {} };

  const { data: access } = await supabase
    .from("user_clients")
    .select("client_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!access?.client_id) return { client: null, policy: {} };

  const [{ data: client }, { data: policyRow }] = await Promise.all([
    supabase
      .from("clients")
      .select("id, name, creator_display_name, niche, follower_count_range")
      .eq("id", access.client_id)
      .maybeSingle(),
    supabase
      .from("client_policies")
      .select("policy_json")
      .eq("client_id", access.client_id)
      .maybeSingle(),
  ]);

  const policy =
    policyRow?.policy_json && typeof policyRow.policy_json === "object"
      ? (policyRow.policy_json as OnboardingPolicy)
      : {};

  return { client: (client as Record<string, unknown> | null) ?? null, policy };
}
