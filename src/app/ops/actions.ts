"use server";

import { revalidatePath } from "next/cache";
import { requireOps } from "@/lib/auth/guards";
import { enqueueJob } from "@/lib/jobs/enqueue";

export async function approveDocument(documentId: string) {
  const { supabase, user } = await requireOps();
  const { error } = await supabase
    .from("documents")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: user.id,
    })
    .eq("id", documentId);
  if (error) {
    throw error;
  }
  revalidatePath("/ops/deals");
}

export async function createContractDraft(dealId: string, templateId: string) {
  const { supabase } = await requireOps();
  const { data: doc, error } = await supabase
    .from("documents")
    .insert({
      deal_id: dealId,
      kind: "contract_draft",
      status: "draft",
      title: `Contract draft ${templateId}`,
      requires_review: true,
      created_by_agent: "ops_console",
    })
    .select("id")
    .single();
  if (error || !doc) {
    throw error ?? new Error("document insert failed");
  }
  await enqueueJob(supabase, {
    jobType: "contract_draft",
    payload: { document_id: doc.id },
    idempotencyKey: `contract-${doc.id}`,
  });
  revalidatePath(`/ops/deals/${dealId}`);
}

export async function createStripeInvoice(dealId: string, amountCents: number) {
  const { supabase } = await requireOps();
  const { data: deal } = await supabase
    .from("deals")
    .select("client_id")
    .eq("id", dealId)
    .single();
  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      client_id: deal?.client_id,
      deal_id: dealId,
      status: "draft",
      amount_cents: amountCents,
      currency: "USD",
      due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10),
      line_items: [{ description: "Brand partnership", amount_cents: amountCents }],
    })
    .select("id")
    .single();
  if (error || !inv) {
    throw error ?? new Error("invoice insert failed");
  }
  await enqueueJob(supabase, {
    jobType: "stripe_invoice",
    payload: { invoice_id: inv.id },
    idempotencyKey: `stripe-${inv.id}`,
  });
  revalidatePath(`/ops/deals/${dealId}`);
}

export async function resolveEscalation(caseId: string, notes: string) {
  const { supabase } = await requireOps();
  const { error } = await supabase
    .from("escalations")
    .update({
      status: "resolved",
      resolution_note: notes,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", caseId);
  if (error) {
    throw error;
  }
  revalidatePath("/ops/escalations");
  revalidatePath("/ops");
}

export async function dismissEscalation(caseId: string, notes: string) {
  const { supabase } = await requireOps();
  const { error } = await supabase
    .from("escalations")
    .update({
      status: "dismissed",
      resolution_note: notes,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", caseId);
  if (error) {
    throw error;
  }
  revalidatePath("/ops/escalations");
  revalidatePath("/ops");
}

export async function approveOutboundMessage(messageId: string) {
  const { supabase, user } = await requireOps();
  const { error } = await supabase
    .from("messages")
    .update({
      requires_review: false,
      reviewed_at: new Date().toISOString(),
      reviewed_by_user_id: user.id,
      status: "scheduled",
    })
    .eq("id", messageId)
    .eq("requires_review", true);
  if (error) {
    throw error;
  }
  await enqueueJob(supabase, {
    jobType: "send_outbound_message",
    payload: { message_id: messageId },
    idempotencyKey: `send-msg-${messageId}`,
  });
  revalidatePath("/ops");
  revalidatePath("/ops/approvals");
}

export async function rejectOutboundMessage(messageId: string, reason: string) {
  const { supabase } = await requireOps();
  const { data: msg, error: fetchErr } = await supabase
    .from("messages")
    .select("id, client_id, deal_id")
    .eq("id", messageId)
    .maybeSingle();
  if (fetchErr || !msg) {
    throw fetchErr ?? new Error("Message not found");
  }

  const { error: escErr } = await supabase.from("escalations").insert({
    client_id: msg.client_id,
    deal_id: msg.deal_id,
    reason: "other",
    severity: "medium",
    summary: `Outbound draft rejected by operator: ${reason}`,
    suggested_action: "Revise draft per operator feedback and resubmit for review.",
    status: "open",
    context_json: { message_id: messageId, rejection_reason: reason },
  });
  if (escErr) {
    throw escErr;
  }

  const { error } = await supabase
    .from("messages")
    .update({
      requires_review: false,
      status: "pending",
    })
    .eq("id", messageId);
  if (error) {
    throw error;
  }
  revalidatePath("/ops");
  revalidatePath("/ops/approvals");
  revalidatePath("/ops/escalations");
}

export async function updateOutboundDraft(
  messageId: string,
  subject: string,
  bodyText: string,
  bodyHtml?: string | null,
) {
  const { supabase } = await requireOps();
  const { error } = await supabase
    .from("messages")
    .update({
      subject: subject.trim() || null,
      body_text: bodyText,
      body_html: bodyHtml ?? null,
    })
    .eq("id", messageId);
  if (error) {
    throw error;
  }
  revalidatePath("/ops/approvals");
}

export async function transitionDealStage(dealId: string, toStage: string) {
  const { supabase, user } = await requireOps();
  const { data: deal } = await supabase
    .from("deals")
    .select("stage, client_id")
    .eq("id", dealId)
    .single();
  if (!deal) {
    throw new Error("Deal not found");
  }

  const { error: uErr } = await supabase
    .from("deals")
    .update({
      stage: toStage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", dealId);
  if (uErr) {
    throw uErr;
  }

  await supabase.from("deal_stage_history").insert({
    deal_id: dealId,
    from_stage: deal.stage,
    to_stage: toStage,
    changed_by_user_id: user.id,
    reason: "manual_operator_transition",
  });

  revalidatePath("/ops/deals");
  revalidatePath(`/ops/deals/${dealId}`);
  revalidatePath("/ops/clients");
  revalidatePath(`/ops/clients/${deal.client_id}`);
}

export async function updateClientPolicyJson(clientId: string, policyJsonText: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(policyJsonText);
  } catch {
    throw new Error("Invalid JSON");
  }
  const { supabase, user } = await requireOps();
  const { data: existing } = await supabase
    .from("client_policies")
    .select("id, version")
    .eq("client_id", clientId)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("client_policies")
      .update({
        policy_json: parsed as Record<string, unknown>,
        version: (existing.version ?? 1) + 1,
        updated_by_user_id: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    if (error) {
      throw error;
    }
  } else {
    const { error } = await supabase.from("client_policies").insert({
      client_id: clientId,
      policy_json: parsed as Record<string, unknown>,
      version: 1,
      updated_by_user_id: user.id,
    });
    if (error) {
      throw error;
    }
  }
  revalidatePath(`/ops/clients/${clientId}`);
}

export async function saveClientPolicyAction(clientId: string, formData: FormData) {
  const text = String(formData.get("policy_json") ?? "{}");
  await updateClientPolicyJson(clientId, text);
}
