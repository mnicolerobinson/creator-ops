import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { enqueueJob } from "@/lib/jobs/enqueue";
import { evaluateIntakeSafety } from "@/lib/intake/safety";
import { sonnetCostCentsFromUsage } from "@/lib/llm/sonnet-cost";
import { isFreeEmailHost } from "@/lib/rdap/domain-registration";

const QUALIFICATION_MODEL = "claude-sonnet-4-20250514";

const SCAM_PHRASES_EXTRA = [
  "money order",
  "wire transfer",
  "send you a check",
  "purchase equipment",
  "western union",
  "gift card",
] as const;

const llmOutputSchema = z.object({
  fit_score: z.number().min(0).max(1),
  reasoning: z.string(),
  campaign_type: z.string(),
  estimated_budget_cents: z.number().nonnegative(),
  missing_fields: z.array(z.string()),
  decision: z.enum(["qualify", "request_info", "decline"]),
  brand_name: z.string().optional(),
});

export type QualificationScorePayload = {
  dealId: string;
  clientId?: string;
  messageId?: string;
};

type AnthropicUsage = { input_tokens: number; output_tokens: number } | null;

function normalizeCampaignKey(ct: string): string {
  return ct
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function lookupMinimumCents(
  minimums: Record<string, unknown> | undefined,
  campaignType: string | null,
): number | null {
  if (!minimums || !campaignType) return null;
  const slug = normalizeCampaignKey(campaignType);
  for (const [k, v] of Object.entries(minimums)) {
    if (normalizeCampaignKey(k) === slug && typeof v === "number") return v;
  }
  const direct = minimums[slug];
  return typeof direct === "number" ? direct : null;
}

function blockedCategoryHit(blocked: unknown, textLower: string): string | null {
  if (!Array.isArray(blocked)) return null;
  for (const cat of blocked) {
    if (typeof cat === "string" && cat.length >= 2 && textLower.includes(cat.toLowerCase())) {
      return cat;
    }
  }
  return null;
}

function hasUrlOrWww(text: string) {
  return /https?:\/\/[^\s<>"')]+/i.test(text) || /\bwww\.[a-z0-9.-]+\.[a-z]{2,}\b/i.test(text);
}

function scamPhraseHit(textLower: string): string | null {
  for (const phrase of SCAM_PHRASES_EXTRA) {
    if (textLower.includes(phrase)) return phrase;
  }
  return null;
}

function evaluateQualificationSpam(args: {
  fullText: string;
  primaryFromAddress: string | null;
  quotedAmountCents: number | null;
}): { decline: boolean; reason: string } {
  const lower = args.fullText.toLowerCase();
  const fromHost = args.primaryFromAddress?.split("@")[1]?.toLowerCase() ?? "";

  const phrase = scamPhraseHit(lower);
  if (phrase) {
    return { decline: true, reason: `Scam phrase detected: "${phrase}"` };
  }

  const budgetUsd =
    args.quotedAmountCents != null ? args.quotedAmountCents / 100 : null;
  if (budgetUsd != null && budgetUsd > 50_000) {
    return { decline: true, reason: "Quoted budget over $50,000 for a single post — likely scam pattern." };
  }

  const freeMail = Boolean(fromHost && isFreeEmailHost(fromHost));
  const looksLikeBrandPitch =
    /\b(?:partnership|collaboration|sponsor|brand deal|paid promotion)\b/i.test(args.fullText);
  if (freeMail && looksLikeBrandPitch && !hasUrlOrWww(args.fullText)) {
    return {
      decline: true,
      reason: "Consumer email domain claiming a brand partnership without company site or corporate domain.",
    };
  }

  return { decline: false, reason: "" };
}

function concatMessages(messages: { body_text: string | null; body_html: string | null }[]) {
  return messages
    .map((m) => (m.body_text ?? m.body_html ?? "").trim())
    .filter(Boolean)
    .join("\n---\n");
}

function parseJsonFromAssistant(text: string): unknown {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence?.[1]?.trim() ?? trimmed;
  return JSON.parse(raw) as unknown;
}

async function finishAgentRun(
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
  const cost = sonnetCostCentsFromUsage(args.usage);
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
    dealId: string;
    eventType: string;
    title: string;
    body?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  await supabase.from("activity_feed").insert({
    client_id: args.clientId,
    deal_id: args.dealId,
    event_type: args.eventType,
    title: args.title,
    body: args.body ?? null,
    actor: "qualification_agent",
    metadata: args.metadata ?? {},
  });
}

async function enqueueDraftReply(
  supabase: SupabaseClient,
  args: {
    dealId: string;
    clientId: string;
    templateKey: "first_touch_qualified" | "request_brief" | "polite_decline";
  },
) {
  await enqueueJob(supabase, {
    jobType: "inbox.draft_reply",
    payload: {
      dealId: args.dealId,
      clientId: args.clientId,
      template_key: args.templateKey,
    },
    idempotencyKey: `inbox-draft:${args.dealId}:${args.templateKey}`,
  });
}

export async function runQualificationScore(
  supabase: SupabaseClient,
  payload: QualificationScorePayload,
): Promise<void> {
  const startedAt = Date.now();
  const { dealId } = payload;

  const { data: deal, error: dealErr } = await supabase
    .from("deals")
    .select(
      "id, client_id, title, stage, campaign_type, quoted_amount_cents, company_id, primary_contact_id",
    )
    .eq("id", dealId)
    .single();

  if (dealErr || !deal) {
    throw dealErr ?? new Error("Deal not found.");
  }

  if (payload.clientId && payload.clientId !== deal.client_id) {
    throw new Error("dealId/clientId mismatch.");
  }

  const clientId = deal.client_id;

  const [{ data: clientRow }, { data: policyRow }, { data: msgs }] = await Promise.all([
    supabase.from("clients").select("creator_display_name").eq("id", clientId).single(),
    supabase.from("client_policies").select("policy_json").eq("client_id", clientId).maybeSingle(),
    supabase
      .from("messages")
      .select("body_text, body_html, from_address, subject, created_at")
      .eq("deal_id", dealId)
      .order("created_at", { ascending: true }),
  ]);

  const creatorName = clientRow?.creator_display_name ?? "Creator";
  const policyJson =
    policyRow?.policy_json && typeof policyRow.policy_json === "object"
      ? (policyRow.policy_json as Record<string, unknown>)
      : {};

  const blocked = policyJson.blocked_categories;
  const minimums = policyJson.minimums_by_campaign_type as Record<string, unknown> | undefined;

  const threadText = concatMessages(msgs ?? []);
  const fullTextForSafety = threadText.length > 0 ? threadText : deal.title ?? "";
  const textLower = fullTextForSafety.toLowerCase();

  const primaryFrom =
    (msgs ?? []).find((m) => m.from_address)?.from_address ??
    (msgs ?? [])[0]?.from_address ??
    null;

  const { data: run } = await supabase
    .from("agent_runs")
    .insert({
      client_id: clientId,
      agent_name: "qualification",
      trigger_event: "qualification.score",
      input_ref: { deal_id: dealId, payload },
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  let usage: AnthropicUsage = null;
  let confidence: number | null = null;

  try {
    if (deal.stage === "new") {
      await supabase
        .from("deals")
        .update({ stage: "qualifying", updated_at: new Date().toISOString() })
        .eq("id", dealId);
    }

    const blockedHit = blockedCategoryHit(blocked, textLower);
    if (blockedHit) {
      const reason = `Hard block: brand/category matches blocked_categories (“${blockedHit}”).`;
      await supabase
        .from("deals")
        .update({
          qualification_score: "1.00",
          qualification_reason: reason,
          stage: "declined",
          decline_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dealId);

      await writeActivity(supabase, {
        clientId,
        dealId,
        eventType: "qualification.completed",
        title: "Deal declined (policy block)",
        body: reason,
        metadata: { blocked_category: blockedHit },
      });

      await enqueueDraftReply(supabase, {
        dealId,
        clientId,
        templateKey: "polite_decline",
      });

      await finishAgentRun(supabase, run?.id, startedAt, {
        status: "success",
        usage: null,
        confidence: 1,
        output_json: { decision: "decline", reason: "blocked_category", blockedHit },
      });
      return;
    }

    const minRequired = lookupMinimumCents(minimums, deal.campaign_type);
    const quoted = deal.quoted_amount_cents ?? null;
    if (minRequired != null && quoted != null && quoted < minRequired) {
      const reason = `Hard block: quoted budget (${quoted}¢) below policy minimum (${minRequired}¢) for campaign type.`;
      await supabase
        .from("deals")
        .update({
          qualification_score: "1.00",
          qualification_reason: reason,
          stage: "declined",
          decline_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dealId);

      await writeActivity(supabase, {
        clientId,
        dealId,
        eventType: "qualification.completed",
        title: "Deal declined (below minimum)",
        body: reason,
        metadata: { minRequired, quoted },
      });

      await enqueueDraftReply(supabase, {
        dealId,
        clientId,
        templateKey: "polite_decline",
      });

      await finishAgentRun(supabase, run?.id, startedAt, {
        status: "success",
        usage: null,
        confidence: 1,
        output_json: { decision: "decline", reason: "below_minimum" },
      });
      return;
    }

    const safetyPre = evaluateQualificationSpam({
      fullText: fullTextForSafety,
      primaryFromAddress: primaryFrom,
      quotedAmountCents: quoted,
    });
    if (safetyPre.decline) {
      await supabase
        .from("deals")
        .update({
          qualification_score: "1.00",
          qualification_reason: safetyPre.reason,
          stage: "declined",
          decline_reason: safetyPre.reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dealId);

      await writeActivity(supabase, {
        clientId,
        dealId,
        eventType: "qualification.completed",
        title: "Deal declined (spam / scam heuristic)",
        body: safetyPre.reason,
      });

      await enqueueDraftReply(supabase, {
        dealId,
        clientId,
        templateKey: "polite_decline",
      });

      await finishAgentRun(supabase, run?.id, startedAt, {
        status: "success",
        usage: null,
        confidence: 1,
        output_json: { decision: "decline", reason: "spam_scam_heuristic" },
      });
      return;
    }

    const intakeSafety = await evaluateIntakeSafety({
      fullText: fullTextForSafety,
      fromAddress: primaryFrom,
      extraction: {
        brandName: deal.title,
        website: null,
        budget:
          quoted != null
            ? { amount: quoted / 100, currency: "USD" }
            : null,
      },
    });

    if (intakeSafety.shouldEscalate) {
      const reason = `Scam / spam signals: ${intakeSafety.flags.join("; ")}`;
      await supabase
        .from("deals")
        .update({
          qualification_score: "1.00",
          qualification_reason: reason,
          stage: "declined",
          decline_reason: reason,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dealId);

      await writeActivity(supabase, {
        clientId,
        dealId,
        eventType: "qualification.completed",
        title: "Deal declined (intake safety)",
        body: reason,
        metadata: { flags: intakeSafety.flags },
      });

      await enqueueDraftReply(supabase, {
        dealId,
        clientId,
        templateKey: "polite_decline",
      });

      await finishAgentRun(supabase, run?.id, startedAt, {
        status: "success",
        usage: null,
        confidence: 1,
        output_json: { decision: "decline", intake_safety: intakeSafety.flags },
      });
      return;
    }

    const apiKey = getEnv().ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required for qualification scoring.");
    }

    const anthropic = new Anthropic({ apiKey });
    const userContent = [
      `Creator display name: ${creatorName}`,
      `Deal id: ${dealId}`,
      `Current deal title: ${deal.title}`,
      `Campaign type (from CRM): ${deal.campaign_type ?? "(unknown)"}`,
      `Quoted amount cents: ${deal.quoted_amount_cents ?? "(none)"}`,
      "",
      "Client policy JSON (abbreviated relevant fields):",
      JSON.stringify(
        {
          blocked_categories: policyJson.blocked_categories,
          minimums_by_campaign_type: policyJson.minimums_by_campaign_type,
          approved_categories: policyJson.approved_categories,
        },
        null,
        2,
      ),
      "",
      "Inbound thread (all messages on this deal):",
      threadText || "(no message bodies)",
    ].join("\n");

    const response = await anthropic.messages.create({
      model: QUALIFICATION_MODEL,
      max_tokens: 1500,
      temperature: 0,
      system: [
        `You are a brand partnership qualification specialist for ${creatorName}.`,
        "Score inbound brand opportunities for fit, legitimacy, and alignment with the creator's policy.",
        "Respond with ONLY valid JSON (no markdown fences) matching this schema:",
        '{"fit_score": number 0-1, "reasoning": string, "campaign_type": string, "estimated_budget_cents": number, "missing_fields": string[], "decision": "qualify" | "request_info" | "decline", "brand_name": string optional}',
        "missing_fields lists concrete CRM fields still needed (e.g. usage rights window, deliverable count).",
      ].join(" "),
      messages: [{ role: "user", content: userContent }],
    });

    usage = response.usage
      ? {
          input_tokens: response.usage.input_tokens,
          output_tokens: response.usage.output_tokens,
        }
      : null;

    const text = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const parsedRaw = parseJsonFromAssistant(text);
    const parsed = llmOutputSchema.parse(parsedRaw);

    let fitScore = parsed.fit_score;
    let finalDecision: "qualify" | "request_info" | "decline";

    if (parsed.decision === "decline" || fitScore < 0.5) {
      finalDecision = "decline";
    } else if (fitScore >= 0.8 && parsed.missing_fields.length === 0) {
      finalDecision = "qualify";
    } else if (
      (fitScore >= 0.5 && fitScore < 0.8) ||
      (fitScore >= 0.8 && parsed.missing_fields.length > 0) ||
      parsed.decision === "request_info"
    ) {
      finalDecision = "request_info";
    } else {
      finalDecision = "decline";
    }

    const scoreStr = fitScore.toFixed(2);
    confidence = fitScore;

    const patch: Record<string, unknown> = {
      qualification_score: scoreStr,
      qualification_reason: parsed.reasoning,
      updated_at: new Date().toISOString(),
    };

    if (parsed.estimated_budget_cents > 0) {
      patch.quoted_amount_cents = Math.round(parsed.estimated_budget_cents);
    }
    if (parsed.campaign_type?.trim()) {
      patch.campaign_type = parsed.campaign_type.trim();
    }
    if (parsed.brand_name?.trim()) {
      patch.title = parsed.brand_name.trim().slice(0, 200);
    }

    if (finalDecision === "decline") {
      patch.stage = "declined";
      patch.decline_reason = parsed.reasoning;
    } else if (finalDecision === "qualify") {
      patch.stage = "qualified";
    } else {
      patch.stage = "qualifying";
    }

    await supabase.from("deals").update(patch).eq("id", dealId);

    await writeActivity(supabase, {
      clientId,
      dealId,
      eventType: "qualification.completed",
      title:
        finalDecision === "qualify"
          ? "Deal qualified"
          : finalDecision === "request_info"
            ? "More information requested"
            : "Deal declined",
      body: parsed.reasoning,
      metadata: {
        fit_score: fitScore,
        decision: finalDecision,
        llm_decision: parsed.decision,
        missing_fields: parsed.missing_fields,
      },
    });

    if (finalDecision === "qualify") {
      await enqueueDraftReply(supabase, {
        dealId,
        clientId,
        templateKey: "first_touch_qualified",
      });
    } else if (finalDecision === "request_info") {
      await enqueueDraftReply(supabase, {
        dealId,
        clientId,
        templateKey: "request_brief",
      });
    } else {
      await enqueueDraftReply(supabase, {
        dealId,
        clientId,
        templateKey: "polite_decline",
      });
    }

    await finishAgentRun(supabase, run?.id, startedAt, {
      status: "success",
      usage,
      confidence,
      output_json: {
        finalDecision,
        parsed,
        model: QUALIFICATION_MODEL,
      },
    });
  } catch (err) {
    await finishAgentRun(supabase, run?.id, startedAt, {
      status: "failed",
      usage,
      error_text: err instanceof Error ? err.message : String(err),
      confidence,
    });
    throw err;
  }
}
