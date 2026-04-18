import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe not configured" }, { status: 501 });
  }

  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const sig = request.headers.get("stripe-signature");
  const raw = await request.text();

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
    const inv = event.data.object as Stripe.Invoice;
    const stripeId = inv.id;
    const { data: row } = await supabase
      .from("invoices")
      .select("id")
      .eq("stripe_invoice_id", stripeId)
      .maybeSingle();

    if (row?.id) {
      await supabase
        .from("invoices")
        .update({
          status: "paid",
          paid_at: new Date(inv.status_transitions?.paid_at ?? Date.now()).toISOString(),
        })
        .eq("id", row.id);

      await supabase.from("agent_action_logs").insert({
        agent: "billing",
        deal_id: null,
        trigger: "stripe.webhook",
        confidence: null,
        result_json: { type: event.type, stripe_invoice_id: stripeId },
      });
    }
  }

  return NextResponse.json({ received: true });
}
