export type SubscriptionTierKey = "starter_ops" | "growth_ops" | "creator_ceo";

export const subscriptionTiers: Record<
  SubscriptionTierKey,
  {
    name: string;
    amountCents: number;
    /** Default monthly LLM spend cap for ops metrics / policy_json (USD cents). */
    monthlyLlmBudgetCents: number;
    lookupKey: string;
    envKey:
      | "STRIPE_PRICE_STARTER_OPS"
      | "STRIPE_PRICE_GROWTH_OPS"
      | "STRIPE_PRICE_CREATOR_CEO";
  }
> = {
  starter_ops: {
    name: "Starter Ops",
    amountCents: 50_000,
    monthlyLlmBudgetCents: 2_500,
    lookupKey: "starter_ops_monthly",
    envKey: "STRIPE_PRICE_STARTER_OPS",
  },
  growth_ops: {
    name: "Growth Ops",
    amountCents: 125_000,
    monthlyLlmBudgetCents: 6_000,
    lookupKey: "growth_ops_monthly",
    envKey: "STRIPE_PRICE_GROWTH_OPS",
  },
  creator_ceo: {
    name: "Creator CEO",
    amountCents: 250_000,
    monthlyLlmBudgetCents: 12_500,
    lookupKey: "creator_ceo_monthly",
    envKey: "STRIPE_PRICE_CREATOR_CEO",
  },
};

export function isSubscriptionTierKey(value: string): value is SubscriptionTierKey {
  return value in subscriptionTiers;
}

/** Monthly LLM budget cap (cents) for metrics and policy defaults; tier-based with optional env fallback when tier is unknown. */
export function monthlyLlmBudgetCentsForTier(tier: string | null | undefined): number {
  if (tier && isSubscriptionTierKey(tier)) {
    return subscriptionTiers[tier].monthlyLlmBudgetCents;
  }
  const env = Number(process.env.CREATOR_LLM_MONTHLY_BUDGET_CENTS);
  if (Number.isFinite(env) && env > 0) {
    return env;
  }
  return subscriptionTiers.starter_ops.monthlyLlmBudgetCents;
}
