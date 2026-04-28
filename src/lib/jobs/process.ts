import type { SupabaseClient } from "@supabase/supabase-js";
import { processInboundEmail } from "@/agents/intake";
import { runQualificationScore } from "@/agents/qualification";
import { sendPersonaEmail } from "@/lib/email/resend";
import { createDraftFromTemplate } from "@/lib/contracts/documenso";
import { createInvoiceForDeal } from "@/lib/billing/stripe";

const MAX_BATCH = 25;

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message);
  }
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

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
      const msg = errorMessage(e);
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
    case "qualification.score": {
      const dealId = payload.dealId as string | undefined;
      if (!dealId) {
        throw new Error("qualification.score missing dealId.");
      }
      const clientId = payload.clientId as string | undefined;
      const messageId = payload.messageId as string | undefined;
      await runQualificationScore(supabase, { dealId, clientId, messageId });
      return;
    }
    case "inbox.draft_reply": {
      const dealId = payload.dealId as string | undefined;
      const clientId = payload.clientId as string | undefined;
      const templateKey = payload.template_key as string | undefined;
      if (!dealId || !clientId || !templateKey) {
        throw new Error("inbox.draft_reply requires dealId, clientId, template_key.");
      }
      await supabase.from("activity_feed").insert({
        client_id: clientId,
        deal_id: dealId,
        event_type: "inbox.draft_enqueued",
        title: `Outbound draft queued (${templateKey})`,
        body: "Awaiting Inbox Agent implementation for template rendering and send.",
        actor: "system",
        metadata: { template_key: templateKey },
      });
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
    case "send_outbound_message": {
      const messageId = payload.message_id as string | undefined;
      if (!messageId) {
        throw new Error("send_outbound_message missing message_id.");
      }
      const { data: msg, error: mErr } = await supabase
        .from("messages")
        .select(
          "id, persona_id, deal_id, client_id, subject, body_text, body_html, to_addresses, thread_id",
        )
        .eq("id", messageId)
        .single();
      if (mErr || !msg) {
        throw new Error(mErr?.message ?? "message not found");
      }
      const to =
        Array.isArray(msg.to_addresses) && msg.to_addresses.length > 0
          ? String(msg.to_addresses[0])
          : null;
      if (!to) {
        throw new Error("message missing to_addresses");
      }
      const { data: persona, error: pErr } = await supabase
        .from("personas")
        .select("sending_email, display_name")
        .eq("id", msg.persona_id as string)
        .maybeSingle();
      if (pErr || !persona?.sending_email) {
        throw new Error(pErr?.message ?? "persona sending identity missing");
      }
      const html =
        (msg.body_html as string | null)?.trim() ||
        `<p>${String(msg.body_text ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br/>")}</p>`;
      const result = await sendPersonaEmail({
        from: persona.sending_email as string,
        to,
        subject: (msg.subject as string) ?? "Message",
        html,
        headers:
          msg.thread_id != null
            ? {
                "In-Reply-To": msg.thread_id as string,
                References: msg.thread_id as string,
              }
            : undefined,
      });
      await supabase
        .from("messages")
        .update({
          status: result.skipped ? "scheduled" : "sent",
          sent_at: result.skipped ? null : new Date().toISOString(),
        })
        .eq("id", messageId);
      return;
    }
    default:
      throw new Error(`unknown job type: ${type}`);
  }
}
