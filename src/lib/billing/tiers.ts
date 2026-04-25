export type SubscriptionTierKey = "starter_ops" | "growth_ops" | "creator_ceo";

export const subscriptionTiers: Record<
  SubscriptionTierKey,
  {
    name: string;
    amountCents: number;
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
    lookupKey: "starter_ops_monthly",
    envKey: "STRIPE_PRICE_STARTER_OPS",
  },
  growth_ops: {
    name: "Growth Ops",
    amountCents: 125_000,
    lookupKey: "growth_ops_monthly",
    envKey: "STRIPE_PRICE_GROWTH_OPS",
  },
  creator_ceo: {
    name: "Creator CEO",
    amountCents: 250_000,
    lookupKey: "creator_ceo_monthly",
    envKey: "STRIPE_PRICE_CREATOR_CEO",
  },
};

export function isSubscriptionTierKey(value: string): value is SubscriptionTierKey {
  return value in subscriptionTiers;
}
