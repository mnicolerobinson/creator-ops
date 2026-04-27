import type { SupabaseClient } from "@supabase/supabase-js";
import { processInboundEmail } from "@/agents/intake";
import { sendPersonaEmail } from "@/lib/email/resend";
import { createDraftFromTemplate } from "@/lib/contracts/documenso";
import { createInvoiceForDeal } from "@/lib/billing/stripe";

const MAX_BATCH = 25;

export async function processJobQueue(supabase: SupabaseClient): Promise<{
  processed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let processed = 0;

  const { data: jobs, error } = await supabase
    .from("job_queue")
    .select("*")
    .eq("status", "pending")
    .lte("run_after", new Date().toISOString())
    .order("run_after", { ascending: true })
    .limit(MAX_BATCH);

  if (error) {
    throw error;
  }

  for (const job of jobs ?? []) {
    const { error: lockErr } = await supabase
      .from("job_queue")
      .update({ status: "processing", attempts: job.attempts + 1 })
      .eq("id", job.id)
      .eq("status", "pending");

    if (lockErr) {
      errors.push(`${job.id}: lock ${lockErr.message}`);
      continue;
    }

    try {
      await runJob(supabase, job.job_type, job.payload_json as Record<string, unknown>);
      await supabase.from("job_queue").update({ status: "done" }).eq("id", job.id);
      processed += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabase
        .from("job_queue")
        .update({
          status: "failed",
          last_error: msg,
        })
        .eq("id", job.id);
      errors.push(`${job.id}: ${msg}`);
    }
  }

  return { processed, errors };
}

async function runJob(
  supabase: SupabaseClient,
  type: string,
  payload: Record<string, unknown>,
) {
  switch (type) {
    case "intake.process_email": {
      const messageId = payload.messageId as string | undefined;
      if (!messageId) {
        throw new Error("intake.process_email missing messageId.");
      }
      await processInboundEmail(supabase, messageId);
      return;
    }
    case "send_scheduled_email": {
      const communicationId = payload.communication_id as string;
      const to = payload.to_email as string;

      const { data: row, error: cErr } = await supabase
        .from("communications")
        .select(
          "id, subject, body, thread_id, confidence_score, persona_id, deal_id, status",
        )
        .eq("id", communicationId)
        .single();

      if (cErr || !row) {
        throw new Error(cErr?.message ?? "communication not found");
      }

      const { data: persona } = await supabase
        .from("personas")
        .select("send_email, display_name")
        .eq("id", row.persona_id as string)
        .single();

      if (!to || !persona) {
        throw new Error("missing email routing");
      }

      const result = await sendPersonaEmail({
        from: persona.send_email,
        to,
        subject: (row.subject as string) ?? "Message",
        html: (row.body as string) ?? "",
        headers: row.thread_id
          ? {
              "In-Reply-To": row.thread_id as string,
              References: row.thread_id as string,
            }
          : undefined,
      });

      const nextStatus = result.skipped ? "scheduled" : "sent";
      await supabase
        .from("communications")
        .update({
          status: nextStatus,
          sent_at: result.skipped ? null : new Date().toISOString(),
        })
        .eq("id", communicationId);

      await supabase.from("agent_action_logs").insert({
        agent: "inbox",
        deal_id: row.deal_id as string,
        trigger: "inbox.send",
        confidence: row.confidence_score as number | null,
        result_json: { communication_id: communicationId, result },
      });
      return;
    }
    case "contract_draft": {
      const documentId = payload.document_id as string;
      const { data: doc, error: dErr } = await supabase
        .from("documents")
        .select("id, template_id, metadata_json, deal_id")
        .eq("id", documentId)
        .single();
      if (dErr || !doc) {
        throw new Error(dErr?.message ?? "document not found");
      }
      const { data: deal } = await supabase
        .from("deals")
        .select("id, title")
        .eq("id", doc.deal_id as string)
        .single();
      if (!deal) {
        throw new Error("deal not found");
      }

      const draft = await createDraftFromTemplate({
        templateId: doc.template_id as string,
        title: `${deal.title} — agreement`,
        meta: (doc.metadata_json as Record<string, string>) ?? {},
      });

      await supabase
        .from("documents")
        .update({
          documenso_document_id: draft.documentId,
          status: "pending_approval",
        })
        .eq("id", documentId);

      await supabase.from("agent_action_logs").insert({
        agent: "contract",
        deal_id: deal.id,
        trigger: "contract.draft",
        confidence: null,
        result_json: draft,
      });
      return;
    }
    case "stripe_invoice": {
      const invoiceRowId = payload.invoice_id as string;
      const { data: inv, error: iErr } = await supabase
        .from("invoices")
        .select("id, amount_cents, metadata_json, deal_id")
        .eq("id", invoiceRowId)
        .single();
      if (iErr || !inv) {
        throw new Error(iErr?.message ?? "invoice not found");
      }

      const { data: deal } = await supabase
        .from("deals")
        .select("id, title, contact_id")
        .eq("id", inv.deal_id as string)
        .single();
      if (!deal?.contact_id) {
        throw new Error("deal or contact missing");
      }
      const { data: contact } = await supabase
        .from("contacts")
        .select("email")
        .eq("id", deal.contact_id)
        .single();
      const email = contact?.email;
      if (!email) {
        throw new Error("contact email missing for invoice");
      }

      const created = await createInvoiceForDeal({
        customerEmail: email,
        amountCents: inv.amount_cents as number,
        description: `Creator Ops — ${deal.title}`,
        metadata: { deal_id: deal.id, invoice_row: invoiceRowId },
      });

      await supabase
        .from("invoices")
        .update({
          stripe_invoice_id: created.stripeInvoiceId,
          status: "open",
          metadata_json: {
            ...((inv.metadata_json as object) ?? {}),
            hosted_invoice_url: created.hostedUrl,
          },
        })
        .eq("id", invoiceRowId);

      await supabase.from("agent_action_logs").insert({
        agent: "billing",
        deal_id: deal.id,
        trigger: "billing.invoice",
        confidence: null,
        result_json: created,
      });
      return;
    }
    case "renewal_ping": {
      const dealId = payload.deal_id as string;
      await supabase.from("tasks").insert({
        deal_id: dealId,
        title: "Renewal outreach",
        due_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        payload_json: { kind: "renewal" },
      });
      await supabase.from("agent_action_logs").insert({
        agent: "renewal",
        deal_id: dealId,
        trigger: "renewal.ping",
        confidence: null,
        result_json: {},
      });
      return;
    }
    default:
      throw new Error(`unknown job type: ${type}`);
  }
}
