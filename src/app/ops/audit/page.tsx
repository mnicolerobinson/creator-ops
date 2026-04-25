import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AuditPage() {
  const supabase = await createServerSupabaseClient();

  const { data: logs } = await supabase
    .from("agent_runs")
    .select("id, agent_name, trigger_event, confidence, output_json, created_at:started_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: overdue } = await supabase
    .from("tasks")
    .select("id, title, due_at, deal_id, completed_at")
    .lt("due_at", new Date().toISOString())
    .is("completed_at", null)
    .limit(50);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit & SLA</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Agent actions (full visibility) and overdue operational tasks.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Revenue / ops risk — overdue tasks
        </h2>
        <ul className="space-y-2 text-sm">
          {(overdue ?? []).map((t) => (
            <li
              key={t.id}
              className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950"
            >
              {t.title} · due {t.due_at ? new Date(t.due_at).toLocaleString() : "—"}{" "}
              · deal {t.deal_id ?? "—"}
            </li>
          ))}
          {(!overdue || overdue.length === 0) && (
            <li className="text-zinc-500">No overdue tasks.</li>
          )}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Agent action log
        </h2>
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-zinc-200 text-xs">
            <thead className="bg-zinc-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-zinc-700">
                  Time
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-700">
                  Agent
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-700">
                  Trigger
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-700">
                  Conf
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-700">
                  Result
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {(logs ?? []).map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2 text-zinc-600">
                    {l.created_at
                      ? new Date(l.created_at).toLocaleString()
                      : ""}
                  </td>
                  <td className="px-3 py-2 text-zinc-800">{l.agent_name}</td>
                  <td className="px-3 py-2 text-zinc-700">{l.trigger_event}</td>
                  <td className="px-3 py-2 text-zinc-700">
                    {l.confidence != null ? Number(l.confidence).toFixed(3) : "—"}
                  </td>
                  <td className="max-w-md truncate px-3 py-2 text-zinc-600">
                    {JSON.stringify(l.output_json)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
