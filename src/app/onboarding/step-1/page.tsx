import Stripe from "stripe";
import { getEnv } from "@/lib/env";
import { StepNav, StepShell } from "../_components";

function formatTier(tier: string | null | undefined) {
  if (tier === "starter_ops") return "Starter Ops — $500/month";
  if (tier === "growth_ops") return "Growth Ops — $1,250/month";
  if (tier === "creator_ceo") return "Creator CEO — $2,500/month";
  return null;
}

async function getTierFromSession(sessionId: string | undefined) {
  if (!sessionId) return null;
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) return null;

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  return session.metadata?.tier ?? null;
}

export default async function OnboardingStepOne({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  let tier: string | null = null;

  try {
    tier = await getTierFromSession(sessionId);
  } catch (error) {
    console.error("Unable to verify Stripe checkout session", error);
  }

  const tierName = formatTier(tier);
  const readyText = tierName
    ? `Your ${tierName} account is ready.`
    : "Your account is ready.";

  return (
    <StepShell
      eyebrow="Step 1 of 7"
      title="Welcome to CreatrOps"
      body={`${readyText} We will walk you through the essentials so your ops team can begin handling brand partnership inquiries.`}
    >
      <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#141414] p-5">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[#B0A89A]">
          Selected tier
        </p>
        <p className="mt-3 font-[var(--font-cormorant)] text-3xl">
          {tierName ?? "Tier unavailable"}
        </p>
      </div>
      <StepNav step={1} />
    </StepShell>
  );
}
