import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { z } from "zod";
import {
  enqueuePgBossJob,
  INTAKE_PROCESS_EMAIL_JOB,
} from "@/lib/jobs/pgboss";
import { createAdminClient } from "@/lib/supabase/admin";

const emailAddressSchema = z.union([
  z.string(),
  z.object({
    email: z.string().optional(),
    name: z.string().optional(),
  }),
]);

const inboundSchema = z
  .object({
    type: z.string().optional(),
    data: z
      .object({
        from: emailAddressSchema.optional(),
        to: z.union([emailAddressSchema, z.array(emailAddressSchema)]).optional(),
        cc: z.union([emailAddressSchema, z.array(emailAddressSchema)]).optional(),
        subject: z.string().optional(),
        text: z.string().optional(),
        html: z.string().optional(),
        message_id: z.string().optional(),
        headers: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

function emailFromAddress(value: z.infer<typeof emailAddressSchema> | undefined) {
  if (!value) return null;
  if (typeof value === "string") {
    const match = value.match(/<([^>]+)>/);
    return (match?.[1] ?? value).trim().toLowerCase();
  }
  return value.email?.trim().toLowerCase() ?? null;
}

function emailList(
  value:
    | z.infer<typeof emailAddressSchema>
    | Array<z.infer<typeof emailAddressSchema>>
    | undefined,
) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list.map(emailFromAddress).filter((email): email is string => Boolean(email));
}

export async function POST(req: Request) {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "Resend webhook not configured" }, { status: 501 });
  }

  const wh = new Webhook(webhookSecret);
  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: unknown;
  try {
    event = wh.verify(payload, headers);
  } catch (err) {
    console.error("Resend inbound webhook verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const parsed = inboundSchema.safeParse(event);
  if (!parsed.success) {
    console.log("Resend inbound webhook rejected invalid payload", {
      issues: parsed.error.flatten(),
    });
    return NextResponse.json({ error: "Invalid inbound email payload" }, { status: 400 });
  }

  const email = parsed.data.data ?? {};
  const toAddresses = emailList(email.to);
  const ccAddresses = emailList(email.cc);
  const fromAddress = emailFromAddress(email.from);
  console.log("Resend inbound webhook verified", {
    type: parsed.data.type,
    fromAddress,
    toAddresses,
    subject: email.subject,
  });

  const supabase = createAdminClient();
  const { data: matchedPersona, error: matchedPersonaError } = await supabase
    .from("personas")
    .select("id, sending_email")
    .in("sending_email", toAddresses)
    .limit(1)
    .maybeSingle();
  if (matchedPersonaError) {
    console.error("Resend inbound persona lookup failed:", matchedPersonaError);
  }
  console.log("Resend inbound persona lookup complete", {
    matchedPersonaId: matchedPersona?.id ?? null,
    matchedSendingEmail: matchedPersona?.sending_email ?? null,
  });

  let personaId = matchedPersona?.id ?? null;
  let clientId: string | null = null;
  let requiresReview = !matchedPersona?.id;

  if (personaId) {
    const { data: clientPersona, error: clientPersonaError } = await supabase
      .from("client_personas")
      .select("client_id")
      .eq("persona_id", personaId)
      .eq("is_primary", true)
      .limit(1)
      .maybeSingle();
    if (clientPersonaError) {
      console.error("Resend inbound client-persona lookup failed:", clientPersonaError);
    }
    clientId = clientPersona?.client_id ?? null;
    requiresReview = requiresReview || !clientId;
    console.log("Resend inbound client-persona lookup complete", {
      personaId,
      clientId,
    });
  }

  if (!personaId || !clientId) {
    const { data: fallbackPersona, error: fallbackPersonaError } = await supabase
      .from("personas")
      .select("id, sending_email")
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    if (fallbackPersonaError) {
      console.error("Resend inbound fallback persona lookup failed:", fallbackPersonaError);
    }
    if (fallbackPersona?.id) {
      personaId = fallbackPersona.id;
      const { data: fallbackClientPersona, error: fallbackClientPersonaError } =
        await supabase
          .from("client_personas")
          .select("client_id")
          .eq("persona_id", fallbackPersona.id)
          .eq("is_primary", true)
          .limit(1)
          .maybeSingle();
      if (fallbackClientPersonaError) {
        console.error(
          "Resend inbound fallback client-persona lookup failed:",
          fallbackClientPersonaError,
        );
      }
      clientId = fallbackClientPersona?.client_id ?? clientId;
      console.log("Resend inbound fallback persona selected", {
        fallbackPersonaId: personaId,
        fallbackSendingEmail: fallbackPersona.sending_email,
        fallbackClientId: clientId,
      });
    }
  }

  if (!clientId) {
    const { data: fallbackClient, error: fallbackClientError } = await supabase
      .from("clients")
      .select("id")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (fallbackClientError) {
      console.error("Resend inbound fallback client lookup failed:", fallbackClientError);
    }
    clientId = fallbackClient?.id ?? null;
    personaId = clientId ? personaId : null;
    requiresReview = true;
    console.log("Resend inbound fallback client selected", {
      fallbackClientId: clientId,
      personaId,
    });
  }

  if (!clientId) {
    console.error("Resend inbound cannot store email without any client record", {
      fromAddress,
      toAddresses,
    });
    return NextResponse.json({ error: "No client available for inbound email" }, { status: 500 });
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      client_id: clientId,
      persona_id: personaId,
      direction: "inbound",
      channel: "email",
      status: "received",
      thread_id:
        (email.headers?.["thread-id"] as string | undefined) ??
        (email.headers?.["references"] as string | undefined) ??
        email.message_id ??
        null,
      in_reply_to: (email.headers?.["in-reply-to"] as string | undefined) ?? null,
      subject: email.subject ?? null,
      body_text: email.text ?? null,
      body_html: email.html ?? null,
      from_address: fromAddress,
      to_addresses: toAddresses,
      cc_addresses: ccAddresses,
      raw_payload: event as Record<string, unknown>,
      received_at: new Date().toISOString(),
      requires_review: requiresReview,
    })
    .select("id")
    .single();

  if (error || !message) {
    console.error("Failed to store inbound Resend email:", error);
    return NextResponse.json({ error: "Could not store inbound email" }, { status: 500 });
  }
  console.log("Resend inbound message stored", {
    messageId: message.id,
    clientId,
    personaId,
    requiresReview,
  });

  const { error: activityError } = await supabase.from("activity_feed").insert({
    client_id: clientId,
    event_type: "intake.email_received",
    title: "Inbound email received",
    body: email.subject ?? fromAddress ?? "New inbound email",
    actor: "resend",
    metadata: { message_id: message.id, from_address: fromAddress, to_addresses: toAddresses },
  });
  if (activityError) {
    console.error("Resend inbound activity feed insert failed:", activityError);
  } else {
    console.log("Resend inbound activity feed written", { messageId: message.id });
  }

  await enqueuePgBossJob(
    INTAKE_PROCESS_EMAIL_JOB,
    { messageId: message.id },
    { singletonKey: `message:${message.id}` },
  );
  console.log("Resend inbound intake job enqueued", { messageId: message.id });

  return NextResponse.json({ received: true, message_id: message.id });
}
