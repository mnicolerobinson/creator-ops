import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { evaluateIntakeSafety } from "@/lib/intake/safety";
import { haikuCostCentsFromUsage } from "@/lib/llm/haiku-cost";
import { enqueueJob } from "@/lib/jobs/enqueue";

const model = "claude-haiku-4-5-20251001";
const fallbackModel = "heuristic-fallback";
const QUALIFICATION_SCORE_JOB = "qualification.score";

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

function fallbackBrandName(email: string | null) {
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

function detectPlatforms(text: string) {
  const platforms = [
    ["instagram", "Instagram"],
    ["tiktok", "TikTok"],
    ["youtube", "YouTube"],
    ["shorts", "YouTube Shorts"],
    ["reels", "Instagram Reels"],
    ["podcast", "Podcast"],
    ["pinterest", "Pinterest"],
    ["snapchat", "Snapchat"],
  ] as const;
  const lower = text.toLowerCase();
  return Array.from(
    new Set(
      platforms
        .filter(([needle]) => lower.includes(needle))
        .map(([, platform]) => platform),
    ),
  );
}

function detectCampaignType(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("instagram reel") || lower.includes("ig reel") || lower.includes("reels")) {
    return "Instagram Reel";
  }
  if (lower.includes("instagram story") || lower.includes("ig story")) {
    return "Instagram Story";
  }
  if (lower.includes("instagram post") || lower.includes("ig post")) {
    return "Instagram Post";
  }
  if (lower.includes("tiktok")) return "TikTok";
  if (lower.includes("youtube short") || lower.includes("shorts")) return "YouTube Shorts";
  if (lower.includes("youtube")) return "YouTube";
  if (lower.includes("ugc")) return "UGC";
  if (lower.includes("affiliate")) return "Affiliate";
  if (lower.includes("sponsor")) return "Sponsored content";
  if (lower.includes("partnership")) return "Partnership";
  if (lower.includes("collab")) return "Collaboration";
  return "Inbound partnership";
}

function detectBudget(text: string): IntakeExtraction["budget"] {
  const budgetContext = text.match(
    /(?:budget|rate|fee|pay|payment|compensation|offer|paid|price|amount)[^\n$]{0,80}\$?\s?(\d{1,3}(?:,\d{3})+|\d{2,6})(?:\.\d{2})?\s?(k|usd|dollars)?/i,
  );
  const dollarAmount = text.match(
    /\$\s?(\d{1,3}(?:,\d{3})+|\d{2,6})(?:\.\d{2})?\s?(k)?/i,
  );
  const match = budgetContext ?? dollarAmount;
  if (!match?.[1]) return null;
  const multiplier = match[2]?.toLowerCase() === "k" ? 1000 : 1;
  const amount = Number(match[1].replace(/,/g, "")) * multiplier;
  return Number.isFinite(amount) ? { amount, currency: "USD" } : null;
}

function detectWebsite(text: string) {
  return text.match(/https?:\/\/[^\s<>"')]+/i)?.[0] ?? null;
}

function cleanBrandCandidate(value: string | undefined) {
  return value
    ?.replace(/^["'\s]+|["'\s]+$/g, "")
    .replace(/\s+(team|brand|company)$/i, "")
    .trim()
    .slice(0, 80);
}

function detectBrandName(text: string, email: string | null) {
  const patterns = [
    /(?:brand|company|client)\s*(?:name)?\s*[:\-]\s*([^\n\r]+)/i,
    /(?:with|from|for)\s+([A-Z][A-Za-z0-9&'.\- ]{2,50})\s+(?:on|for|about|regarding)\s+(?:an?\s+)?(?:instagram|tiktok|youtube|ugc|sponsored|partnership|collab)/i,
    /([A-Z][A-Za-z0-9&'.\- ]{2,50})\s+(?:would like|is interested|wants|reached out|invited)/i,
  ];
  for (const pattern of patterns) {
    const candidate = cleanBrandCandidate(text.match(pattern)?.[1]);
    if (candidate) return candidate;
  }

  const domain = email?.split("@")[1]?.split(".")[0];
  if (domain && !["gmail", "icloud", "yahoo", "outlook", "hotmail"].includes(domain)) {
    return domain.replace(/[-_]/g, " ");
  }

  return fallbackBrandName(email);
}

function inferSenderName(email: string | null) {
  const local = email?.split("@")[0];
  if (!local) return null;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function heuristicExtractInboundEmail(message: {
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  from_address: string | null;
}): IntakeExtraction {
  const text = getMessageText(message);
  const lower = text.toLowerCase();
  const isOutOfOffice =
    lower.includes("out of office") ||
    lower.includes("automatic reply") ||
    lower.includes("auto-reply");
  const isSpam =
    lower.includes("unsubscribe") ||
    lower.includes("mailer-daemon") ||
    lower.includes("delivery status notification");

  return {
    isSpam,
    isOutOfOffice,
    spamReason: isOutOfOffice
      ? "Detected automatic/out-of-office reply."
      : isSpam
        ? "Detected newsletter, bounce, or spam-like email."
        : null,
    brandName: detectBrandName(text, message.from_address),
    website: detectWebsite(text),
    campaignType: detectCampaignType(text),
    platforms: detectPlatforms(text),
    budget: detectBudget(text),
    timeline: null,
    senderName: inferSenderName(message.from_address),
    senderTitle: null,
  };
}

type AnthropicUsage = { input_tokens: number; output_tokens: number } | null;

async function extractInboundEmail(message: {
  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  from_address: string | null;
}): Promise<{ extraction: IntakeExtraction; usage: AnthropicUsage }> {
  const apiKey = getEnv().ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("ANTHROPIC_API_KEY missing; using heuristic intake extraction.");
    return { extraction: heuristicExtractInboundEmail(message), usage: null };
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model,
      max_tokens: 1200,
      temperature: 0,
      system:
        "You are the CreatrOps Intake Agent. Extract brand deal CRM fields from inbound creator partnership emails. Return only compact JSON matching this schema: { isSpam:boolean, isOutOfOffice:boolean, spamReason:string|null, brandName:string|null, website:string|null, campaignType:string|null, platforms:string[], budget:{amount:number|null,currency:string|null}|null, timeline:string|null, senderName:string|null, senderTitle:string|null }. Rules: brandName MUST be the brand/company name from the email body, never the email subject. campaignType MUST be the specific requested activation when present, e.g. Instagram Reel, Instagram Story, TikTok, YouTube, YouTube Shorts, UGC, Sponsored content, Affiliate. budget.amount MUST be the numeric budget/rate/offer mentioned in the email body in dollars, with currency USD unless stated otherwise. Treat newsletters, auto-replies, undeliverable notices, obvious spam, and out-of-office replies as spam or OOO.",
      messages: [
        {
          role: "user",
          content: getMessageText(message),
        },
      ],
    });

    const usage: AnthropicUsage = response.usage
      ? {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        }
      : null;

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const json = JSON.parse(text) as unknown;
    return { extraction: extractionSchema.parse(json), usage };
  } catch (error) {
    console.error("Anthropic intake extraction failed; using heuristic fallback:", error);
    return { extraction: heuristicExtractInboundEmail(message), usage: null };
  }
}

async function finishIntakeAgentRun(
  supabase: SupabaseClient,
  runId: string | undefined,
  startedAt: number,
  args: {
    status: "success" | "failed";
    output_json?: unknown;
    error_text?: string | null;
    usage: AnthropicUsage;
    confidence?: number | null;
  },
) {
  if (!runId) return;
  const cost = haikuCostCentsFromUsage(args.usage);
  await supabase
    .from("agent_runs")
    .update({
      status: args.status,
      output_json: args.output_json ?? null,
      error_text: args.error_text ?? null,
      llm_cost_cents: cost,
      llm_tokens_input: args.usage?.input_tokens ?? null,
      llm_tokens_output: args.usage?.output_tokens ?? null,
      confidence: args.confidence ?? null,
      duration_ms: Date.now() - startedAt,
      ended_at: new Date().toISOString(),
    })
    .eq("id", runId);
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
    const { extraction, usage } = await extractInboundEmail(message);
    const fullMessageText = getMessageText(message);
    const rawPayload = mergeRawPayload(message.raw_payload, {
      intake: {
        model,
        fallback_model: fallbackModel,
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

      await finishIntakeAgentRun(supabase, run?.id, startedAt, {
        status: "success",
        output_json: { ignored: true, reason, extraction },
        usage,
      });

      return { status: "ignored", messageId, reason };
    }

    const safety = await evaluateIntakeSafety({
      fullText: fullMessageText,
      fromAddress: message.from_address,
      extraction: {
        brandName: extraction.brandName,
        website: extraction.website,
        budget: extraction.budget,
      },
    });

    if (safety.shouldEscalate) {
      const reasonText = `Scam / spam filter: ${safety.flags.join("; ")}${safety.domainAgeNote ? ` (${safety.domainAgeNote})` : ""}`;
      const rawPayloadSafe = mergeRawPayload(message.raw_payload, {
        intake: {
          model,
          fallback_model: fallbackModel,
          extraction,
          safety: { flags: safety.flags, domain_note: safety.domainAgeNote },
          processed_at: new Date().toISOString(),
        },
      });

      await supabase.from("messages").update({ raw_payload: rawPayloadSafe }).eq("id", messageId);

      await supabase.from("escalations").insert({
        client_id: message.client_id,
        deal_id: null,
        agent_run_id: run?.id,
        reason: "policy_violation",
        severity: "high",
        summary: `[Scam / spam filter] ${safety.flags.join("; ")}`,
        context_json: {
          intake_safety: {
            escalation: true,
            flags: safety.flags,
            message_id: messageId,
            domain_note: safety.domainAgeNote,
          },
        },
        suggested_action: "Review the inbound message; block the sender if this is a confirmed scam.",
        status: "open",
      });

      await writeActivity(supabase, {
        clientId: message.client_id,
        eventType: "intake.safety_escalation",
        title: "Inbound message flagged by scam / spam checks",
        body: reasonText,
        metadata: {
          message_id: messageId,
          flags: safety.flags,
          extraction,
        },
      });

      await finishIntakeAgentRun(supabase, run?.id, startedAt, {
        status: "success",
        output_json: { ignored: true, safety: safety.flags, extraction },
        usage,
      });

      return { status: "ignored", messageId, reason: reasonText };
    }

    const brandName =
      extraction.brandName ??
      detectBrandName(getMessageText(message), message.from_address);
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
          source: "inbound_email",
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
          source: "inbound_email",
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
        title: brandName,
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

    await enqueueJob(supabase, {
      jobType: QUALIFICATION_SCORE_JOB,
      payload: { dealId: deal.id, clientId: message.client_id, messageId },
      idempotencyKey: `deal:${deal.id}`,
    });

    await writeActivity(supabase, {
      clientId: message.client_id,
      dealId: deal.id,
      eventType: "intake.qualification_enqueued",
      title: "Qualification queued",
      body: "The intake agent queued this deal for scoring.",
      metadata: { deal_id: deal.id, message_id: messageId },
    });

    await finishIntakeAgentRun(supabase, run?.id, startedAt, {
      status: "success",
      confidence: 0.9,
      output_json: {
        deal_id: deal.id,
        company_id: company.id,
        contact_id: contact.id,
        extraction,
      },
      usage,
    });

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
