import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EscalationResolve } from "./resolve";

export default async function EscalationsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: cases } = await supabase
    .from("escalations")
    .select("id, deal_id, reason, severity, status, summary, created_at")
    .order("created_at", { ascending: false });

  const open = (cases ?? []).filter((c) => c.status === "open");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Escalations</h1>
        <p className="mt-2 text-sm text-zinc-600">
          {open.length} open · Persona, legal, and low-confidence routing.
        </p>
      </div>
      <ul className="space-y-4">
        {(cases ?? []).map((c) => (
          <li
            key={c.id}
            className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium text-zinc-900">
                  {c.reason} · severity {c.severity}
                </p>
                <p className="mt-1 text-sm text-zinc-600">{c.summary}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  {c.deal_id ? `Deal ${c.deal_id}` : "No deal"}{" "}
                  · {c.status} ·{" "}
                  {c.created_at
                    ? new Date(c.created_at).toLocaleString()
                    : ""}
                </p>
              </div>
              {c.status === "open" ? (
                <EscalationResolve caseId={c.id} />
              ) : null}
            </div>
          </li>
        ))}
        {(!cases || cases.length === 0) && (
          <li className="text-sm text-zinc-500">No escalation cases.</li>
        )}
      </ul>
    </div>
  );
}
