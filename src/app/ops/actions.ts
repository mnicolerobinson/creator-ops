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
}
