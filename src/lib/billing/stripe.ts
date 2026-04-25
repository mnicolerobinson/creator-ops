import Stripe from "stripe";
import { getEnv } from "@/lib/env";
import {
  isSubscriptionTierKey,
  subscriptionTiers,
  type SubscriptionTierKey,
} from "./tiers";

export function getStripe(): Stripe {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
}

export async function resolveSubscriptionPriceId(
  tierKey: SubscriptionTierKey,
): Promise<string> {
  const env = getEnv();
  const tier = subscriptionTiers[tierKey];
  const configured = env[tier.envKey];
  if (configured) {
    return configured;
  }

  const stripe = getStripe();
  const prices = await stripe.prices.list({
    active: true,
    lookup_keys: [tier.lookupKey],
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) {
    throw new Error(`No Stripe price configured for ${tier.name}.`);
  }
  return price.id;
}

export async function createSubscriptionCheckoutSession(args: {
  tier: string;
  email: string;
  referralCode?: string | null;
}): Promise<{ url: string }> {
  if (!isSubscriptionTierKey(args.tier)) {
    throw new Error("Invalid subscription tier.");
  }

  const env = getEnv();
  const stripe = getStripe();
  const tier = subscriptionTiers[args.tier];
  const price = await resolveSubscriptionPriceId(args.tier);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: args.email,
    line_items: [{ price, quantity: 1 }],
    success_url: `${env.NEXT_PUBLIC_SITE_URL}/login?checkout=success`,
    cancel_url: `${env.NEXT_PUBLIC_SITE_URL}/login?checkout=cancelled`,
    metadata: {
      tier: args.tier,
      tier_name: tier.name,
      referral_code: args.referralCode ?? "",
    },
    subscription_data: {
      metadata: {
        tier: args.tier,
        referral_code: args.referralCode ?? "",
      },
    },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL.");
  }

  return { url: session.url };
}

export async function createInvoiceForDeal(args: {
  customerEmail: string;
  amountCents: number;
  description: string;
  metadata: Record<string, string>;
}): Promise<{ stripeInvoiceId: string; hostedUrl: string | null }> {
  const stripe = getStripe();
  const customers = await stripe.customers.list({
    email: args.customerEmail,
    limit: 1,
  });
  const customer =
    customers.data[0] ??
    (await stripe.customers.create({ email: args.customerEmail }));

  const invoice = await stripe.invoices.create({
    customer: customer.id,
    collection_method: "send_invoice",
    days_until_due: 14,
    metadata: args.metadata,
  });

  await stripe.invoiceItems.create({
    customer: customer.id,
    invoice: invoice.id,
    amount: args.amountCents,
    currency: "usd",
    description: args.description,
  });

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
  return {
    stripeInvoiceId: finalized.id,
    hostedUrl: finalized.hosted_invoice_url ?? null,
  };
}
