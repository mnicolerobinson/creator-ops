import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import {
  enqueuePgBossJob,
  QUALIFICATION_SCORE_JOB,
} from "@/lib/jobs/pgboss";

const model = "claude-haiku-4-5-20251001";

const extractionSchema = z.object({
  isSpam: z.boolean(),
  isOutOfOffice: z.boolean(),
  spamReason: z.string().nullable(),
  brandName: z.string().nullable(),
  website: z.string().nullable(),
  campaignType: z.string().nullable(),
  platforms: z.array(z.string()).default([]),
  budget: z
    .object({
      amount: z.number().nullable(),
      currency: z.string().nullable(),
    })
    .nullable(),
  timeline: z.string().nullable(),
  senderName: z.string().nullable(),
  senderTitle: z.string().nullable(),
});

type IntakeExtraction = z.infer<typeof extractionSchema>;

type IntakeResult =
  | {
      status: "ignored";
      messageId: string;
      reason: string;
    }
  | {
      status: "created";
      messageId: string;
      companyId: string;
      contactId: string;
      dealId: string;
      extraction: IntakeExtraction;
    };

function mergeRawPayload(
  raw: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return {
    ...(raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}),
    ...patch,
  };
}

function budgetToCents(budget: IntakeExtraction["budget"]) {
  if (!budget?.amount) return null;
  return Math.round(budget.amount * 100);
}

function fallbackBrandName(email: string | null, subject: string | null) {
  if (subject?.trim()) {
    return subject.trim().replace(/^re:\s*/i, "").slice(0, 80);
  }
  const domain = email?.split("@")[1]?.split(".")[0];
  return domain ? domain.replace(/[-_]/g, " ") : "Inbound opportunity";
}

function getMessageText(message: {
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  from_address: string | null;
}) {
  return [
    `From: ${message.from_address ?? "unknown"}`,
    `Subject: ${message.subject ?? "(none)"}`,
    "",
    message.body_text ?? message.body_html ?? "",
  ].join("\n");
}

async function extractInboundEmail(message: {
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  from_address: string | null;
}) {
  const apiKey = getEnv().ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is required for intake extraction.");
  }

  const anthropic = new Anthropic({ apiKey });
  const response = await anthropic.messages.create({
    model,
    max_tokens: 1200,
    temperature: 0,
    system:
      "You are the CreatrOps Intake Agent. Extract brand deal CRM fields from inbound creator partnership emails. Return only compact JSON matching this schema: { isSpam:boolean, isOutOfOffice:boolean, spamReason:string|null, brandName:string|null, website:string|null, campaignType:string|null, platforms:string[], budget:{amount:number|null,currency:string|null}|null, timeline:string|null, senderName:string|null, senderTitle:string|null }. Treat newsletters, auto-replies, undeliverable notices, obvious spam, and out-of-office replies as spam or OOO.",
    messages: [
      {
        role: "user",
        content: getMessageText(message),
      },
    ],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  const json = JSON.parse(text) as unknown;
  return extractionSchema.parse(json);
}

async function writeActivity(
  supabase: SupabaseClient,
  args: {
    clientId: string;
    dealId?: string | null;
    eventType: string;
    title: string;
    body?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("activity_feed").insert({
    client_id: args.clientId,
    deal_id: args.dealId ?? null,
    event_type: args.eventType,
    title: args.title,
    body: args.body ?? null,
    actor: "intake_agent",
    metadata: args.metadata ?? {},
  });
}

export async function processInboundEmail(
  supabase: SupabaseClient,
  messageId: string,
): Promise<IntakeResult> {
  const startedAt = Date.now();
  const { data: message, error } = await supabase
    .from("messages")
    .select(
      "id, client_id, deal_id, persona_id, subject, body_text, body_html, from_address, raw_payload",
    )
    .eq("id", messageId)
    .single();

  if (error || !message) {
    throw error ?? new Error("Inbound message not found.");
  }

  const { data: run } = await supabase
    .from("agent_runs")
    .insert({
      client_id: message.client_id,
      agent_name: "intake",
      trigger_event: "intake.process_email",
      input_ref: { message_id: messageId },
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  try {
    const extraction = await extractInboundEmail(message);
    const rawPayload = mergeRawPayload(message.raw_payload, {
      intake: {
        model,
        extraction,
        processed_at: new Date().toISOString(),
      },
    });

    if (extraction.isSpam || extraction.isOutOfOffice) {
      const reason =
        extraction.spamReason ??
        (extraction.isOutOfOffice ? "Out-of-office reply" : "Spam or non-opportunity");

      await supabase
        .from("messages")
        .update({ raw_payload: rawPayload })
        .eq("id", messageId);

      await writeActivity(supabase, {
        clientId: message.client_id,
        eventType: "intake.email_ignored",
        title: "Inbound email ignored",
        body: reason,
        metadata: { message_id: messageId, extraction },
      });

      await supabase
        .from("agent_runs")
        .update({
          status: "success",
          output_json: { ignored: true, reason, extraction },
          duration_ms: Date.now() - startedAt,
          ended_at: new Date().toISOString(),
        })
        .eq("id", run?.id);

      return { status: "ignored", messageId, reason };
    }

    const brandName =
      extraction.brandName ??
      fallbackBrandName(message.from_address, message.subject);
    const website = extraction.website;

    let company = null as { id: string } | null;
    if (website) {
      const { data } = await supabase
        .from("companies")
        .select("id")
        .eq("client_id", message.client_id)
        .eq("website", website)
        .maybeSingle();
      company = data;
    }

    if (!company) {
      const { data } = await supabase
        .from("companies")
        .select("id")
        .eq("client_id", message.client_id)
        .ilike("name", brandName)
        .maybeSingle();
      company = data;
    }

    if (!company) {
      const { data, error: companyError } = await supabase
        .from("companies")
        .insert({
          client_id: message.client_id,
          name: brandName,
          website,
          notes: "Created by intake agent from inbound email.",
        })
        .select("id")
        .single();
      if (companyError || !data) {
        throw companyError ?? new Error("Unable to create company.");
      }
      company = data;
    }

    const contactEmail = message.from_address;
    let contact = null as { id: string } | null;
    if (contactEmail) {
      const { data } = await supabase
        .from("contacts")
        .select("id")
        .eq("client_id", message.client_id)
        .eq("email", contactEmail)
        .maybeSingle();
      contact = data;
    }

    if (!contact) {
      const { data, error: contactError } = await supabase
        .from("contacts")
        .insert({
          client_id: message.client_id,
          company_id: company.id,
          email: contactEmail ?? `unknown-${messageId}@inbound.local`,
          full_name: extraction.senderName,
          title: extraction.senderTitle,
          source: "resend_inbound",
        })
        .select("id")
        .single();
      if (contactError || !data) {
        throw contactError ?? new Error("Unable to create contact.");
      }
      contact = data;
    } else {
      await supabase
        .from("contacts")
        .update({
          company_id: company.id,
          full_name: extraction.senderName,
          title: extraction.senderTitle,
          source: "resend_inbound",
        })
        .eq("id", contact.id);
    }

    const quotedAmountCents = budgetToCents(extraction.budget);
    const { data: deal, error: dealError } = await supabase
      .from("deals")
      .insert({
        client_id: message.client_id,
        primary_contact_id: contact.id,
        company_id: company.id,
        assigned_persona_id: message.persona_id,
        title: `${brandName} - ${extraction.campaignType ?? "Inbound opportunity"}`,
        stage: "new",
        campaign_type: extraction.campaignType,
        platforms: extraction.platforms,
        quoted_amount_cents: quotedAmountCents,
        currency: extraction.budget?.currency ?? "USD",
        deliverables: { timeline: extraction.timeline },
      })
      .select("id")
      .single();

    if (dealError || !deal) {
      throw dealError ?? new Error("Unable to create deal.");
    }

    await supabase
      .from("messages")
      .update({
        deal_id: deal.id,
        contact_id: contact.id,
        raw_payload: rawPayload,
      })
      .eq("id", messageId);

    await writeActivity(supabase, {
      clientId: message.client_id,
      dealId: deal.id,
      eventType: "intake.deal_created",
      title: `New deal created for ${brandName}`,
      body: extraction.campaignType ?? message.subject,
      metadata: {
        message_id: messageId,
        company_id: company.id,
        contact_id: contact.id,
        extraction,
      },
    });

    await enqueuePgBossJob(
      QUALIFICATION_SCORE_JOB,
      { dealId: deal.id, messageId },
      { singletonKey: `deal:${deal.id}` },
    );

    await writeActivity(supabase, {
      clientId: message.client_id,
      dealId: deal.id,
      eventType: "intake.qualification_enqueued",
      title: "Qualification queued",
      body: "The intake agent queued this deal for scoring.",
      metadata: { deal_id: deal.id, message_id: messageId },
    });

    await supabase
      .from("agent_runs")
      .update({
        status: "success",
        confidence: "0.90",
        output_json: {
          deal_id: deal.id,
          company_id: company.id,
          contact_id: contact.id,
          extraction,
        },
        duration_ms: Date.now() - startedAt,
        ended_at: new Date().toISOString(),
      })
      .eq("id", run?.id);

    return {
      status: "created",
      messageId,
      companyId: company.id,
      contactId: contact.id,
      dealId: deal.id,
      extraction,
    };
  } catch (err) {
    await supabase
      .from("agent_runs")
      .update({
        status: "failed",
        error_text: err instanceof Error ? err.message : String(err),
        duration_ms: Date.now() - startedAt,
        ended_at: new Date().toISOString(),
      })
      .eq("id", run?.id);
    throw err;
  }
}
