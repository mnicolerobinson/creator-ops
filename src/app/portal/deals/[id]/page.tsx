import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PortalDealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();

  const { data: deal } = await supabase
    .from("deals")
    .select("id, title, stage, qualification_reason, qualification_score, quoted_amount_cents")
    .eq("id", id)
    .single();

  if (!deal) {
    notFound();
  }

  const { data: docs } = await supabase
    .from("documents")
    .select("id, kind, status")
    .eq("deal_id", id);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, status, amount_cents, due_date, paid_at")
    .eq("deal_id", id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{deal.title}</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {deal.stage} · {deal.qualification_reason ?? "Qualification pending"}
          {deal.quoted_amount_cents != null
            ? ` · budget $${(deal.quoted_amount_cents / 100).toFixed(2)}`
            : ""}
        </p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-zinc-500">Documents</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {(docs ?? []).map((d) => (
            <li key={d.id} className="rounded border border-zinc-200 px-3 py-2">
              {d.kind} · {d.status}
            </li>
          ))}
          {(!docs || docs.length === 0) && (
            <li className="text-zinc-500">No documents.</li>
          )}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-zinc-500">Invoices</h2>
        <ul className="mt-2 space-y-2 text-sm">
          {(invoices ?? []).map((inv) => (
            <li key={inv.id} className="rounded border border-zinc-200 px-3 py-2">
              {inv.status} · ${((inv.amount_cents ?? 0) / 100).toFixed(2)}
              {inv.due_date
                ? ` · due ${new Date(inv.due_date).toLocaleDateString()}`
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
