import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { z } from "zod";
import { getEnv } from "@/lib/env";
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

export async function POST(request: Request) {
  const env = getEnv();
  if (!env.RESEND_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Resend webhook not configured" }, { status: 501 });
  }

  const rawBody = await request.text();
  let payload: unknown;
  try {
    payload = new Webhook(env.RESEND_WEBHOOK_SECRET).verify(rawBody, {
      "svix-id": request.headers.get("svix-id") ?? "",
      "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
      "svix-signature": request.headers.get("svix-signature") ?? "",
    });
  } catch (error) {
    console.error("Resend inbound webhook verification failed:", error);
    return new Response("Webhook signature verification failed", { status: 400 });
  }

  const parsed = inboundSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid inbound email payload" }, { status: 400 });
  }

  const email = parsed.data.data ?? {};
  const toAddresses = emailList(email.to);
  const ccAddresses = emailList(email.cc);
  const fromAddress = emailFromAddress(email.from);

  const supabase = createAdminClient();
  const { data: persona } = await supabase
    .from("personas")
    .select("id, sending_email")
    .in("sending_email", toAddresses)
    .limit(1)
    .maybeSingle();

  if (!persona?.id) {
    await supabase.from("audit_log").insert({
      actor_type: "system",
      actor_id: "resend.inbound",
      action: "inbound_email.unmatched_persona",
      entity_type: "message",
      entity_id: email.message_id ?? null,
      diff_json: { to_addresses: toAddresses, payload },
    });
    return NextResponse.json({ received: true, matched: false });
  }

  const { data: clientPersona } = await supabase
    .from("client_personas")
    .select("client_id")
    .eq("persona_id", persona.id)
    .eq("is_primary", true)
    .limit(1)
    .maybeSingle();

  if (!clientPersona?.client_id) {
    await supabase.from("audit_log").insert({
      actor_type: "system",
      actor_id: "resend.inbound",
      action: "inbound_email.unassigned_persona",
      entity_type: "persona",
      entity_id: persona.id,
      diff_json: { to_addresses: toAddresses },
    });
    return NextResponse.json({ received: true, matched: false });
  }

  const { data: message, error } = await supabase
    .from("messages")
    .insert({
      client_id: clientPersona.client_id,
      persona_id: persona.id,
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
      raw_payload: payload as Record<string, unknown>,
      received_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !message) {
    console.error("Failed to store inbound Resend email:", error);
    return NextResponse.json({ error: "Could not store inbound email" }, { status: 500 });
  }

  await supabase.from("activity_feed").insert({
    client_id: clientPersona.client_id,
    event_type: "intake.email_received",
    title: "Inbound email received",
    body: email.subject ?? fromAddress ?? "New inbound email",
    actor: "resend",
    metadata: { message_id: message.id, from_address: fromAddress, to_addresses: toAddresses },
  });

  await enqueuePgBossJob(
    INTAKE_PROCESS_EMAIL_JOB,
    { messageId: message.id },
    { singletonKey: `message:${message.id}` },
  );

  return NextResponse.json({ received: true });
}
