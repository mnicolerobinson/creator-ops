import Stripe from "stripe";
import { getEnv } from "@/lib/env";
import { StepShell } from "../_components";
import { TierSummary } from "./tier-summary";

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
    >
      <TierSummary initialTier={tier} />
    </StepShell>
  );
}
