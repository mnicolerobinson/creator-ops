import { NextResponse } from "next/server";
import { z } from "zod";
import { createSubscriptionCheckoutSession } from "@/lib/billing/stripe";

const checkoutSchema = z.object({
  tier: z.enum(["starter_ops", "growth_ops", "creator_ceo"]),
  email: z.string().email(),
  referralCode: z.string().optional(),
});

export async function POST(request: Request) {
  const parsed = checkoutSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
  }

  try {
    const session = await createSubscriptionCheckoutSession(parsed.data);
    return NextResponse.json(session);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create checkout session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
