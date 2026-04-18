import type { SupabaseClient } from "@supabase/supabase-js";
import { INBOX_AUTO, INBOX_REVIEW } from "@/lib/agents/thresholds";

export const BOT_TRIGGERS = [
  "are you a bot",
  "are you ai",
  "automated system",
  "is this automated",
  "real person",
  "human",
];

export const LEGAL_TRIGGERS = [
  "lawsuit",
  "attorney",
  "legal action",
  "cease and desist",
  "sue",
];

export function detectEscalationTriggers(body: string): {
  bot: boolean;
  legal: boolean;
} {
  const lower = body.toLowerCase();
  return {
    bot: BOT_TRIGGERS.some((t) => lower.includes(t)),
    legal: LEGAL_TRIGGERS.some((t) => lower.includes(t)),
  };
}

/**
 * PRD: 8–45 min first touch, 15–90 min follow-ups — modeled as random jitter in minutes.
 */
export function nextCadenceMinutes(kind: "first_touch" | "follow_up"): number {
  const [min, max] =
    kind === "first_touch" ? [8, 45] : [15, 90];
  return Math.floor(min + Math.random() * (max - min + 1));
}

export function scheduleAfterMinutes(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

export type DraftDecision =
  | { kind: "auto_send"; scheduledAt: string }
  | { kind: "queued_review" }
  | { kind: "escalated"; reason: "bot_detection" | "legal_threat" };

export function decideOutboundDraft(
  confidence: number,
  body: string,
): DraftDecision {
  const triggers = detectEscalationTriggers(body);
  if (triggers.bot) {
    return { kind: "escalated", reason: "bot_detection" };
  }
  if (triggers.legal) {
    return { kind: "escalated", reason: "legal_threat" };
  }
  if (confidence >= INBOX_AUTO) {
    return {
      kind: "auto_send",
      scheduledAt: scheduleAfterMinutes(nextCadenceMinutes("first_touch")),
    };
  }
  if (confidence >= INBOX_REVIEW) {
    return { kind: "queued_review" };
  }
  return { kind: "queued_review" };
}

export async function recordInboundCommunication(
  supabase: SupabaseClient,
  args: {
    dealId: string;
    personaId: string | null;
    subject: string | null;
    body: string;
  },
): Promise<{ id: string }> {
  const flags: string[] = [];
  const t = detectEscalationTriggers(args.body);
  if (t.bot) {
    flags.push("bot_detection");
  }
  if (t.legal) {
    flags.push("legal_threat");
  }

  const { data, error } = await supabase
    .from("communications")
    .insert({
      deal_id: args.dealId,
      persona_id: args.personaId,
      direction: "inbound",
      status: "received",
      subject: args.subject,
      body: args.body,
      trigger_flags: flags,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw error ?? new Error("communication insert failed");
  }

  if (t.bot || t.legal) {
    await supabase.from("escalation_cases").insert({
      deal_id: args.dealId,
      reason: t.bot ? "bot_detection" : "legal_threat",
      severity: t.legal ? 4 : 3,
      summary: "Inbound message matched escalation triggers.",
    });
  }

  await supabase.from("agent_action_logs").insert({
    agent: "inbox",
    deal_id: args.dealId,
    trigger: "inbox.inbound",
    confidence: null,
    result_json: { communication_id: data.id, flags },
  });

  return { id: data.id };
}
