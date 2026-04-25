import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getEnv } from "@/lib/env";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://creatrops.com",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const checkoutSchema = z.object({
  tier: z.enum(["starter_ops", "growth_ops", "creator_ceo"]),
});

function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...corsHeaders,
      ...init?.headers,
    },
  });
}

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return json({ error: "Invalid checkout request" }, { status: 400 });
  }

  try {
    const env = getEnv();
    if (!env.STRIPE_SECRET_KEY) {
      return json({ error: "Stripe is not configured" }, { status: 501 });
    }

    const priceByTier = {
      starter_ops: env.STRIPE_PRICE_STARTER_OPS,
      growth_ops: env.STRIPE_PRICE_GROWTH_OPS,
      creator_ceo: env.STRIPE_PRICE_CREATOR_CEO,
    };
    const price = priceByTier[parsed.data.tier];
    if (!price) {
      return json({ error: "Stripe price is not configured" }, { status: 501 });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url:
        "https://app.creatrops.com/onboarding/step-1?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://creatrops.com/welcome",
      metadata: { tier: parsed.data.tier },
    });

    return json({ url: session.url });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create checkout session";
    return json({ error: message }, { status: 500 });
  }
}
