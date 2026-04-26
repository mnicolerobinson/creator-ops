import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getEnv } from "@/lib/env";

const allowedOrigins = new Set(["https://creatrops.com", "https://www.creatrops.com"]);

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin":
      origin && allowedOrigins.has(origin) ? origin : "https://creatrops.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

const checkoutSchema = z.object({
  tier: z.enum(["starter", "growth", "ceo", "starter_ops", "growth_ops", "creator_ceo"]),
  email: z.string().email().optional(),
});

function json(request: Request, data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      ...corsHeaders(request.headers.get("origin")),
      ...init?.headers,
    },
  });
}

function normalizeStripePriceId(price: string) {
  return price.startsWith("price_") ? price : `price_${price}`;
}

export function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  try {
    const parsed = checkoutSchema.safeParse(await request.json());
    if (!parsed.success) {
      console.error("Stripe checkout request validation failed", parsed.error);
      return json(request, { error: "Invalid checkout request" }, { status: 400 });
    }

    const env = getEnv();
    if (!env.STRIPE_SECRET_KEY) {
      return json(request, { error: "Stripe is not configured" }, { status: 501 });
    }

    const tierMap = {
      starter: "starter_ops",
      growth: "growth_ops",
      ceo: "creator_ceo",
      starter_ops: "starter_ops",
      growth_ops: "growth_ops",
      creator_ceo: "creator_ceo",
    } as const;
    const tier = tierMap[parsed.data.tier];
    const priceByTier = {
      starter_ops: env.STRIPE_PRICE_STARTER_OPS,
      growth_ops: env.STRIPE_PRICE_GROWTH_OPS,
      creator_ceo: env.STRIPE_PRICE_CREATOR_CEO,
    };
    const rawPrice = priceByTier[tier];
    const price = rawPrice ? normalizeStripePriceId(rawPrice) : undefined;
    if (!price) {
      return json(request, { error: "Stripe price is not configured" }, { status: 501 });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      ...(parsed.data.email ? { customer_email: parsed.data.email } : {}),
      line_items: [{ price, quantity: 1 }],
      success_url:
        "https://app.creatrops.com/onboarding/step-1?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://creatrops.com/welcome",
      metadata: { tier },
    });

    return json(request, { url: session.url });
  } catch (error) {
    console.error("Stripe checkout creation failed", error);
    const message =
      error instanceof Error ? error.message : "Unable to create checkout session";
    return json(request, { error: message }, { status: 500 });
  }
}
