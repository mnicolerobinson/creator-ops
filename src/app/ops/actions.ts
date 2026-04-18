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
      approved_at: new Date().toISOString(),
      approved_by: user.id,
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
      kind: "contract",
      status: "draft",
      template_id: templateId,
      requires_approval: true,
      metadata_json: { source: "ops_console" },
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
  const { data: inv, error } = await supabase
    .from("invoices")
    .insert({
      deal_id: dealId,
      status: "draft",
      amount_cents: amountCents,
      currency: "usd",
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
    .from("escalation_cases")
    .update({
      status: "resolved",
      resolution_notes: notes,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", caseId);
  if (error) {
    throw error;
  }
  revalidatePath("/ops/escalations");
}
