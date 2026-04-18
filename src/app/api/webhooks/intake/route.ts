import { NextResponse } from "next/server";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { runIntake } from "@/lib/agents/intake";
import { applyQualification } from "@/lib/agents/qualification";
import { decideOutboundDraft } from "@/lib/agents/inbox";
import { enqueueJob } from "@/lib/jobs/enqueue";

const bodySchema = z.object({
  creator_id: z.string().uuid(),
  contact: z.object({
    email: z.string().email().optional().nullable(),
    name: z.string().optional().nullable(),
    company: z.string().optional().nullable(),
    source: z.string().optional().nullable(),
  }),
  deal: z.object({
    title: z.string().min(1),
    campaign_type: z.string().optional().nullable(),
    platform: z.string().optional().nullable(),
    budget_cents: z.number().int().optional().nullable(),
    rights_summary: z.string().optional().nullable(),
  }),
  /** Optional model/heuristic score 0–1; default 0.72 */
  qualification_score: z.number().min(0).max(1).optional(),
});

export async function POST(request: Request) {
  const env = getEnv();
  const secret = request.headers.get("x-webhook-secret");
  if (!env.INTAKE_WEBHOOK_SECRET || secret !== env.INTAKE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { contactId, dealId } = await runIntake(supabase, {
    creatorId: parsed.data.creator_id,
    contact: parsed.data.contact,
    deal: parsed.data.deal,
  });

  const { data: creator } = await supabase
    .from("creators")
    .select("policy_json")
    .eq("id", parsed.data.creator_id)
    .single();

  const policy = (creator?.policy_json as Record<string, unknown>) ?? {};
  const minCents = (policy.default_minimum_cents as number | undefined) ?? undefined;

  const rawScore = parsed.data.qualification_score ?? 0.72;

  const qual = await applyQualification(supabase, {
    dealId,
    rawScore,
    budgetCents: parsed.data.deal.budget_cents,
    policyMinCents: minCents,
  });

  await supabase.from("tasks").insert({
    deal_id: dealId,
    title: "Review new inbound opportunity",
    due_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    payload_json: { kind: "deal_ops", contact_id: contactId },
  });

  const { data: dealRow } = await supabase
    .from("deals")
    .select("persona_id, qualification_status")
    .eq("id", dealId)
    .single();

  const personaId = dealRow?.persona_id as string | null;
  if (personaId && dealRow?.qualification_status !== "declined") {
    const bodyText =
      "Thanks for reaching out — we received your inquiry and will follow up with next steps.";
    const confidence = 0.88;
    const decision = decideOutboundDraft(confidence, bodyText);

    if (decision.kind === "escalated") {
      await supabase.from("communications").insert({
        deal_id: dealId,
        persona_id: personaId,
        direction: "outbound",
        status: "escalated",
        subject: "Re: your inquiry",
        body: bodyText,
        confidence_score: confidence,
      });
    } else if (decision.kind === "queued_review") {
      await supabase.from("communications").insert({
        deal_id: dealId,
        persona_id: personaId,
        direction: "outbound",
        status: "queued_review",
        subject: "Re: your inquiry",
        body: bodyText,
        confidence_score: confidence,
      });
    } else {
      const scheduledAt = decision.scheduledAt;
      const { data: comm } = await supabase
        .from("communications")
        .insert({
          deal_id: dealId,
          persona_id: personaId,
          direction: "outbound",
          status: "scheduled",
          subject: "Re: your inquiry",
          body: bodyText,
          confidence_score: confidence,
          scheduled_at: scheduledAt,
        })
        .select("id")
        .single();

      if (comm?.id && parsed.data.contact.email) {
        await enqueueJob(supabase, {
          jobType: "send_scheduled_email",
          payload: {
            communication_id: comm.id,
            to_email: parsed.data.contact.email,
          },
          runAfter: scheduledAt,
          idempotencyKey: `send-${comm.id}`,
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    contact_id: contactId,
    deal_id: dealId,
    qualification: qual,
  });
}
