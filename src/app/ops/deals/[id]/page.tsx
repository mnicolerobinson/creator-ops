import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ApproveButton, DealActions } from "./ui";

export default async function OpsDealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, title, stage, qualification_status, fit_score, budget_cents, campaign_type, platform, rights_summary",
    )
    .eq("id", id)
    .single();

  if (!deal) {
    notFound();
  }

  const { data: comms } = await supabase
    .from("communications")
    .select("id, direction, status, subject, body, confidence_score, created_at")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  const { data: docs } = await supabase
    .from("documents")
    .select("id, kind, status, template_id, documenso_document_id, requires_approval")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, status, amount_cents, stripe_invoice_id, due_at, paid_at")
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {deal.stage} · {deal.qualification_status}
          {deal.fit_score != null
            ? ` · fit ${Number(deal.fit_score).toFixed(3)}`
            : ""}
        </p>
      </div>

      <DealActions dealId={deal.id} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Communications
        </h2>
        <ul className="space-y-3">
          {(comms ?? []).map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-zinc-200 bg-white p-4 text-sm shadow-sm"
            >
              <p className="font-medium text-zinc-900">
                {c.direction} · {c.status}
                {c.confidence_score != null
                  ? ` · conf ${Number(c.confidence_score).toFixed(3)}`
                  : ""}
              </p>
              {c.subject ? (
                <p className="mt-1 text-zinc-700">{c.subject}</p>
              ) : null}
              {c.body ? (
                <p className="mt-2 whitespace-pre-wrap text-zinc-600">
                  {c.body}
                </p>
              ) : null}
            </li>
          ))}
          {(!comms || comms.length === 0) && (
            <li className="text-sm text-zinc-500">No messages yet.</li>
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Documents
        </h2>
        <ul className="space-y-2 text-sm">
          {(docs ?? []).map((d) => (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-200 bg-white px-3 py-2"
            >
              <span>
                {d.kind} · {d.status}
                {d.documenso_document_id
                  ? ` · Documenso ${d.documenso_document_id}`
                  : ""}
              </span>
              {d.status === "pending_approval" && d.requires_approval ? (
                <ApproveButton documentId={d.id} />
              ) : null}
            </li>
          ))}
          {(!docs || docs.length === 0) && (
            <li className="text-zinc-500">No documents.</li>
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Invoices
        </h2>
        <ul className="space-y-2 text-sm">
          {(invoices ?? []).map((inv) => (
            <li
              key={inv.id}
              className="rounded border border-zinc-200 bg-white px-3 py-2"
            >
              {inv.status} · {(inv.amount_cents ?? 0) / 100} USD
              {inv.stripe_invoice_id
                ? ` · Stripe ${inv.stripe_invoice_id}`
                : ""}
            </li>
          ))}
          {(!invoices || invoices.length === 0) && (
            <li className="text-zinc-500">No invoices.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
