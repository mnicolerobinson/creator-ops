"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";

type JsonRecord = Record<string, unknown>;

function values(formData: FormData, key: string) {
  return formData.getAll(key).map(String).filter(Boolean);
}

function value(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

function numberValue(formData: FormData, key: string) {
  const raw = value(formData, key);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

async function saveOnboardingStep({
  step,
  clientPatch,
  policyPatch,
  redirectNext = true,
}: {
  step: number;
  clientPatch?: JsonRecord;
  policyPatch: JsonRecord;
  redirectNext?: boolean;
}) {
  const { supabase, user, clientAccess } = await requireUser();
  if (!clientAccess?.client_id) {
    redirect("/login?error=auth");
  }

  const clientId = clientAccess.client_id;
  const { data: existingPolicy } = await supabase
    .from("client_policies")
    .select("policy_json")
    .eq("client_id", clientId)
    .maybeSingle();

  const currentPolicy =
    existingPolicy?.policy_json && typeof existingPolicy.policy_json === "object"
      ? (existingPolicy.policy_json as JsonRecord)
      : {};

  const { error: policyError } = await supabase.from("client_policies").upsert(
    {
      client_id: clientId,
      policy_json: {
        ...currentPolicy,
        ...policyPatch,
      },
      updated_by_user_id: user.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "client_id" },
  );
  if (policyError) throw policyError;

  const { error: clientError } = await supabase
    .from("clients")
    .update({
      ...(clientPatch ?? {}),
      wizard_step: Math.max(step + 1, step),
      updated_at: new Date().toISOString(),
    })
    .eq("id", clientId);
  if (clientError) throw clientError;

  if (redirectNext) {
    redirect(`/onboarding/step-${Math.min(step + 1, 7)}`);
  }
}

function creatorProfilePayload(formData: FormData) {
  const primaryPlatforms = values(formData, "primary_platforms");
  const followerRanges = Object.fromEntries(
    primaryPlatforms.map((platform) => [
      platform,
      value(formData, `follower_count_${platform}`) ?? "",
    ]),
  );
  const displayName = value(formData, "display_name");
  const primaryNiche = value(formData, "primary_niche");

  return {
    clientPatch: {
      ...(displayName ? { creator_display_name: displayName, name: displayName } : {}),
      ...(primaryNiche ? { niche: primaryNiche } : {}),
      follower_count_range: JSON.stringify(followerRanges),
    },
    policyPatch: {
      creator_profile: {
        display_name: displayName,
        primary_niche: primaryNiche,
        primary_platforms: primaryPlatforms,
        follower_count_range_per_platform: followerRanges,
      },
    },
  };
}

export async function saveCreatorProfile(formData: FormData) {
  const payload = creatorProfilePayload(formData);

  await saveOnboardingStep({
    step: 2,
    ...payload,
  });
}

export async function saveCreatorProfileWithoutRedirect(formData: FormData) {
  const payload = creatorProfilePayload(formData);

  await saveOnboardingStep({
    step: 2,
    ...payload,
    redirectNext: false,
  });
}

export async function saveRateCard(formData: FormData) {
  const setUpLater = formData.get("set_up_later") === "on";
  const rates = {
    instagram_reel: numberValue(formData, "rate_instagram_reel"),
    story: numberValue(formData, "rate_story"),
    tiktok_video: numberValue(formData, "rate_tiktok_video"),
    youtube_dedicated: numberValue(formData, "rate_youtube_dedicated"),
    youtube_integration: numberValue(formData, "rate_youtube_integration"),
    blog_post: numberValue(formData, "rate_blog_post"),
    podcast: numberValue(formData, "rate_podcast"),
  };
  const minimumBudget = numberValue(formData, "minimum_budget");

  await saveOnboardingStep({
    step: 3,
    policyPatch: {
      rate_card: {
        set_up_later: setUpLater,
        minimum_budget_cents: minimumBudget ? minimumBudget * 100 : null,
        rates_cents: Object.fromEntries(
          Object.entries(rates).map(([key, amount]) => [
            key,
            amount ? amount * 100 : null,
          ]),
        ),
        escalate_rate_decisions: setUpLater,
      },
      default_minimum_cents: minimumBudget ? minimumBudget * 100 : null,
    },
  });
}

export async function saveBrandPreferences(formData: FormData) {
  await saveOnboardingStep({
    step: 4,
    policyPatch: {
      blocked_categories: values(formData, "blocked_categories").map((category) =>
        category.toLowerCase(),
      ),
      brand_preferences: {
        brands_to_always_decline: value(formData, "always_decline"),
        brands_to_always_accept: value(formData, "always_accept"),
      },
    },
  });
}

export async function saveContractSetup(formData: FormData) {
  const setupPath = value(formData, "setup_path") ?? "template";

  await saveOnboardingStep({
    step: 5,
    policyPatch: {
      contract_setup: {
        setup_path: setupPath,
        uploaded_pdf_name:
          formData.get("contract_pdf") instanceof File
            ? (formData.get("contract_pdf") as File).name
            : null,
        template: {
          payment_terms: value(formData, "payment_terms"),
          revision_rounds: value(formData, "revision_rounds"),
          exclusivity: value(formData, "exclusivity"),
          usage_rights_duration_days: value(formData, "usage_rights_duration"),
          governing_state: value(formData, "governing_state"),
        },
      },
    },
  });
}

export async function saveInboxSetup(formData: FormData) {
  await saveOnboardingStep({
    step: 6,
    policyPatch: {
      inbox_setup: {
        dedicated_email: value(formData, "dedicated_email"),
        forwarding_provider: value(formData, "forwarding_provider"),
        test_email_requested: formData.get("send_test_email") === "on",
      },
    },
  });
}
