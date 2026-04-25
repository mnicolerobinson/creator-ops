"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const campaignTypes = [
  "instagram_reel",
  "story",
  "tiktok_video",
  "youtube_dedicated",
  "youtube_integration",
  "blog_post",
  "podcast",
];

function readList(formData: FormData, key: string) {
  return formData
    .getAll(key)
    .map(String)
    .filter(Boolean);
}

function referralCodeFrom(nameOrEmail: string) {
  const base =
    nameOrEmail
      .split("@")[0]
      ?.replace(/[^a-z]/gi, "")
      .slice(0, 10)
      .toUpperCase() || "CREATOR";
  return `${base}${Math.floor(1000 + Math.random() * 9000)}`;
}

async function getOnboardingContext() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: access } = await supabase
    .from("user_clients")
    .select("client_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!access?.client_id) {
    redirect("/login?error=auth");
  }

  return { supabase, user, clientId: access.client_id };
}

export async function saveOnboardingStep(formData: FormData) {
  const step = Number(formData.get("step") ?? 1);
  const { supabase, user, clientId } = await getOnboardingContext();
  const nextStep = Math.min(step + 1, 7);

  if (step === 1) {
    await supabase.from("clients").update({ wizard_step: 2 }).eq("id", clientId);
    redirect("/onboarding/step-2");
  }

  if (step === 2) {
    const platforms = readList(formData, "platforms");
    await supabase
      .from("clients")
      .update({
        creator_display_name: String(formData.get("display_name") ?? ""),
        niche: String(formData.get("niche") ?? ""),
        handle_tiktok: String(formData.get("handle_tiktok") ?? "") || null,
        handle_instagram: String(formData.get("handle_instagram") ?? "") || null,
        handle_youtube: String(formData.get("handle_youtube") ?? "") || null,
        handle_twitter: platforms.includes("twitter") ? "active" : null,
        follower_count_range: String(formData.get("follower_count_range") ?? ""),
        wizard_step: 3,
      })
      .eq("id", clientId);
    redirect("/onboarding/step-3");
  }

  if (step === 3) {
    const minimum = Number(formData.get("minimum_budget_cents") ?? 0);
    const rates = Object.fromEntries(
      campaignTypes.map((type) => [
        type,
        Number(formData.get(`rate_${type}`) ?? 0),
      ]),
    );
    await supabase.from("client_policies").upsert({
      client_id: clientId,
      policy_json: {
        minimums_by_campaign_type: rates,
        minimum_budget_to_respond_cents: minimum,
        rate_decisions_escalate: formData.get("setup_later") === "on",
      },
    });
    await supabase.from("clients").update({ wizard_step: 4 }).eq("id", clientId);
    redirect("/onboarding/step-4");
  }

  if (step === 4) {
    const { data: policy } = await supabase
      .from("client_policies")
      .select("policy_json")
      .eq("client_id", clientId)
      .maybeSingle();
    await supabase.from("client_policies").upsert({
      client_id: clientId,
      policy_json: {
        ...(policy?.policy_json as Record<string, unknown> | null),
        blocked_categories: readList(formData, "blocked_categories"),
        always_decline_brands: String(formData.get("decline_brands") ?? ""),
        always_accept_brands: String(formData.get("accept_brands") ?? ""),
      },
    });
    await supabase.from("clients").update({ wizard_step: 5 }).eq("id", clientId);
    redirect("/onboarding/step-5");
  }

  if (step === 5) {
    await supabase.from("documents").insert({
      client_id: clientId,
      kind: "contract_draft",
      status: "draft",
      title: "Onboarding contract setup",
      content_text: JSON.stringify({
        setup_path: formData.get("contract_path"),
        payment_terms: formData.get("payment_terms"),
        revision_rounds: formData.get("revision_rounds"),
        exclusivity: formData.get("exclusivity"),
        usage_rights_duration: formData.get("usage_rights_duration"),
        governing_state: formData.get("governing_state"),
      }),
    });
    await supabase.from("clients").update({ wizard_step: 6 }).eq("id", clientId);
    redirect("/onboarding/step-6");
  }

  if (step === 6) {
    await supabase.from("activity_feed").insert({
      client_id: clientId,
      event_type: "inbox_setup",
      title: "Inbox forwarding setup reviewed",
      body: "Creator acknowledged forwarding setup instructions.",
      actor: "system",
    });
    await supabase.from("clients").update({ wizard_step: 7 }).eq("id", clientId);
    redirect("/onboarding/step-7");
  }

  if (step === 7) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("referral_code, email, full_name")
      .eq("id", user.id)
      .single();
    const referralCode =
      profile?.referral_code ??
      referralCodeFrom(profile?.full_name ?? profile?.email ?? user.email ?? "creator");
    await supabase
      .from("user_profiles")
      .update({ referral_code: referralCode })
      .eq("id", user.id);
    await supabase
      .from("clients")
      .update({
        wizard_step: 7,
        status: "active",
        onboarding_completed_at: new Date().toISOString(),
        onboarded_at: new Date().toISOString(),
      })
      .eq("id", clientId);
    redirect("/dashboard");
  }

  redirect(`/onboarding/step-${nextStep}`);
}

export async function saveAndContinueLater() {
  redirect("/dashboard");
}
