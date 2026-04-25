import { NextResponse } from "next/server";
import Stripe from "stripe";
import { subscriptionTiers, type SubscriptionTierKey } from "@/lib/billing/tiers";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

function referralCodeBase(email: string) {
  return email.split("@")[0]?.replace(/[^a-z0-9]/gi, "").slice(0, 18) || "creator";
}

async function ensureSarahPersona(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string> {
  const { data: existing } = await supabase
    .from("personas")
    .select("id")
    .eq("sending_email", "sarah@ops.creatrops.com")
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("personas")
    .insert({
      display_name: "Sarah Chen",
      title: "Partnerships Lead",
      sending_email: "sarah@ops.creatrops.com",
      sending_name: "Sarah Chen",
      signature_html:
        "Sarah Chen<br/>Partnerships Lead<br/>sarah@ops.creatrops.com",
      voice_profile_json: {
        tone: "professional, warm, concise",
        signoff: "Sarah",
      },
    })
    .select("id")
    .single();
  if (error || !data) {
    throw error ?? new Error("Unable to seed Sarah Chen persona.");
  }
  return data.id;
}

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const email = session.customer_details?.email ?? session.customer_email;
    const tier = session.metadata?.tier as SubscriptionTierKey | undefined;

    if (!email || !tier || !(tier in subscriptionTiers)) {
      return NextResponse.json(
        { error: "Checkout session missing email or tier" },
        { status: 400 },
      );
    }

    const authResult = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { source: "stripe_checkout" },
    });

    let userId = authResult.data.user?.id ?? null;
    if (authResult.error) {
      const { data: existingProfile } = await supabase
        .from("user_profiles")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      userId = existingProfile?.id ?? null;
    }

    if (!userId) {
      throw authResult.error ?? new Error("Unable to create or find auth user.");
    }

    const customerId =
      typeof session.customer === "string" ? session.customer : session.customer?.id;
    const subscriptionId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription?.id;
    const tierConfig = subscriptionTiers[tier];
    const displayName =
      session.customer_details?.name ?? referralCodeBase(email).replace(/\d+$/, "");

    await supabase.from("user_profiles").upsert({
      id: userId,
      email,
      full_name: session.customer_details?.name ?? null,
      role: "creator",
    });

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .upsert(
        {
          name: displayName,
          creator_display_name: displayName,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          subscription_tier: tier,
          subscription_status: "active",
          status: "onboarding",
          wizard_step: 1,
        },
        { onConflict: "stripe_customer_id" },
      )
      .select("id")
      .single();
    if (clientError || !client) {
      throw clientError ?? new Error("Unable to create client.");
    }

    await supabase.from("user_clients").upsert({
      user_id: userId,
      client_id: client.id,
      access_level: "full",
    });

    const personaId = await ensureSarahPersona(supabase);
    await supabase.from("client_personas").upsert({
      client_id: client.id,
      persona_id: personaId,
      is_primary: true,
    });

    await supabase.from("client_policies").upsert({
      client_id: client.id,
      policy_json: {
        minimums_by_campaign_type: {},
        blocked_categories: ["gambling", "crypto", "tobacco", "firearms", "mlm"],
        approved_categories: [],
        tier: tierConfig.name,
      },
    });

    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${env.NEXT_PUBLIC_SITE_URL}/auth/callback?next=/onboarding/step-1`,
      },
    });
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
    const inv = event.data.object as Stripe.Invoice;
    const stripeId = inv.id;
    const { data: row } = await supabase
      .from("invoices")
      .select("id, client_id")
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

      if (row.client_id) {
        await supabase.from("agent_runs").insert({
          client_id: row.client_id,
          agent_name: "billing",
          trigger_event: "stripe.webhook",
          status: "success",
          output_json: { type: event.type, stripe_invoice_id: stripeId },
          ended_at: new Date().toISOString(),
        });
      }
    }
  }

  if (event.type === "invoice.payment_failed") {
    const inv = event.data.object as Stripe.Invoice;
    const customerId =
      typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
    if (customerId) {
      await supabase
        .from("clients")
        .update({ subscription_status: "past_due" })
        .eq("stripe_customer_id", customerId);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object as Stripe.Subscription;
    await supabase
      .from("clients")
      .update({ subscription_status: "canceled", status: "churned" })
      .eq("stripe_subscription_id", subscription.id);
  }

  return NextResponse.json({ received: true });
}
