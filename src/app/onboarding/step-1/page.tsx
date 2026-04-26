import Stripe from "stripe";
import { getEnv } from "@/lib/env";
import { StepNav, StepShell } from "../_components";

function formatTier(tier: string | null | undefined) {
  if (tier === "starter_ops") return "Starter Ops";
  if (tier === "growth_ops") return "Growth Ops";
  if (tier === "creator_ceo") return "Creator CEO";
  return "your selected tier";
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

  return (
    <StepShell
      eyebrow="Step 1 of 7"
      title="Welcome to CreatrOps"
      body={`Your ${formatTier(tier)} account is ready. We will walk you through the essentials so your ops team can begin handling brand partnership inquiries.`}
    >
      <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#141414] p-5">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[#B0A89A]">
          Selected tier
        </p>
        <p className="mt-3 font-[var(--font-cormorant)] text-3xl">
          {formatTier(tier)}
        </p>
      </div>
      <StepNav step={1} />
    </StepShell>
  );
}
