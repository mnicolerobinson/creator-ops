import Link from "next/link";
import { requireOpsClientAccess } from "@/lib/auth/guards";
import { OpsClientMessages } from "../../client-messages";
import { saveClientPolicyAction } from "../../actions";

function fmtMoney(cents: number | null | undefined, currency: string) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function OpsClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase } = await requireOpsClientAccess(id);

  const [{ data: client }, { data: personaRows }, { data: policy }, { data: deals }] =
    await Promise.all([
      supabase.from("clients").select("*").eq("id", id).single(),
      supabase
        .from("client_personas")
        .select(
          "is_primary, personas ( id, display_name, title, sending_email, sending_name )",
        )
        .eq("client_id", id),
      supabase.from("client_policies").select("*").eq("client_id", id).maybeSingle(),
      supabase
        .from("deals")
        .select(
          "id, title, stage, campaign_type, quoted_amount_cents, currency, due_date, updated_at",
        )
        .eq("client_id", id)
        .order("updated_at", { ascending: false }),
    ]);

  if (!client) {
    return (
      <p className="text-[#C8102E]">Client not found.</p>
    );
  }

  const [{ data: documents }, { data: activity }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, kind, status, deal_id, updated_at")
      .eq("client_id", id)
      .order("updated_at", { ascending: false })
      .limit(50),
    supabase
      .from("activity_feed")
      .select("id, title, body, actor, event_type, created_at, deal_id")
      .eq("client_id", id)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const primaryLink =
    (personaRows ?? []).find((r: { is_primary?: boolean }) => r.is_primary) ??
    (personaRows ?? [])[0];
  const rawPersona = primaryLink?.personas;
  const persona = Array.isArray(rawPersona) ? rawPersona[0] : rawPersona;

  const policyJson =
    policy?.policy_json != null ? JSON.stringify(policy.policy_json, null, 2) : "{}";

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/ops/clients"
            className="text-[10px] uppercase tracking-[0.25em] text-[#C9A84C] hover:underline"
          >
            ← All clients
          </Link>
          <p className="mt-3 text-[10px] uppercase tracking-[0.4em] text-[#C8102E]">
            Client workspace
          </p>
          <h1 className="mt-2 font-[var(--font-cormorant)] text-4xl font-light text-[#F7F0E8]">
            {client.creator_display_name}
          </h1>
          <p className="mt-1 text-sm text-[#8F8678]">{client.name}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#B0A89A]">
            <span className="rounded-full border border-[#2A211C] px-2 py-0.5 capitalize">
              {client.status}
            </span>
            <span className="rounded-full border border-[#C9A84C]/40 px-2 py-0.5 text-[#C9A84C]">
              {(client.subscription_tier ?? "").replace(/_/g, " ") || "—"}
            </span>
          </div>
        </div>
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-6">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8102E]">Assigned persona</p>
          {persona ? (
            <>
              <h2 className="mt-3 font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">
                {persona.display_name}
              </h2>
              <p className="text-sm text-[#8F8678]">{persona.title}</p>
              <p className="mt-3 text-sm text-[#B0A89A]">
                Sends as{" "}
                <span className="text-[#F7F0E8]">{persona.sending_name}</span> ·{" "}
                <span className="text-[#C9A84C]">{persona.sending_email}</span>
              </p>
            </>
          ) : (
            <p className="mt-4 text-sm text-[#6F675E]">No persona assigned yet.</p>
          )}
        </div>

        <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-6">
          <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8102E]">Policy profile</p>
          <p className="mt-2 text-xs text-[#6F675E]">
            JSON consumed by agents for gates and negotiation bounds. Edit carefully — invalid JSON
            will not save.
          </p>
          <form action={saveClientPolicyAction.bind(null, id)} className="mt-4 space-y-3">
            <textarea
              name="policy_json"
              rows={14}
              defaultValue={policyJson}
              className="w-full rounded-2xl border border-[#2A211C] bg-[#050505] p-4 font-mono text-xs leading-relaxed text-[#F7F0E8] outline-none focus:border-[#C8102E]/40"
              spellCheck={false}
            />
            <button
              type="submit"
              className="rounded-full bg-[#C8102E] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-white"
            >
              Save policy
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8102E]">
              Deal pipeline
            </p>
            <h2 className="mt-2 font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">
              Opportunities
            </h2>
          </div>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-[#2A211C] text-[10px] uppercase tracking-[0.18em] text-[#6F675E]">
              <tr>
                <th className="pb-3 pr-4 font-normal">Deal</th>
                <th className="pb-3 pr-4 font-normal">Campaign</th>
                <th className="pb-3 pr-4 font-normal">Value</th>
                <th className="pb-3 pr-4 font-normal">Stage</th>
                <th className="pb-3 font-normal">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D1713]">
              {(deals ?? []).map((d) => (
                <tr key={d.id}>
                  <td className="py-3 pr-4">
                    <Link
                      href={`/ops/deals/${d.id}`}
                      className="font-medium text-[#F7F0E8] hover:text-[#C9A84C]"
                    >
                      {d.title}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-[#B0A89A]">{d.campaign_type ?? "—"}</td>
                  <td className="py-3 pr-4 text-[#C9A84C]">
                    {fmtMoney(d.quoted_amount_cents, d.currency)}
                  </td>
                  <td className="py-3 pr-4">
                    <span className="rounded-full border border-[#C8102E]/35 bg-[#C8102E]/10 px-2 py-0.5 text-xs capitalize text-[#FFCED6]">
                      {String(d.stage).replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="py-3 text-[#6F675E]">
                    {d.due_date ? new Date(d.due_date).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(deals ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-[#6F675E]">No deals for this client.</p>
          )}
        </div>
      </section>

      <OpsClientMessages clientId={id} clientName={client.creator_display_name} />

      <section className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-6">
        <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8102E]">Documents</p>
        <h2 className="mt-2 font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">Library</h2>
        <ul className="mt-4 divide-y divide-[#1D1713]">
          {(documents ?? []).map((doc) => (
            <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-[#F7F0E8]">{doc.title}</p>
                <p className="text-[10px] uppercase tracking-wider text-[#6F675E]">
                  {doc.kind} · {doc.status}
                  {doc.deal_id ? (
                    <>
                      {" · "}
                      <Link href={`/ops/deals/${doc.deal_id}`} className="text-[#C9A84C] hover:underline">
                        Deal
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <span className="text-xs text-[#5c544a]">
                {doc.updated_at ? new Date(doc.updated_at).toLocaleString() : ""}
              </span>
            </li>
          ))}
          {(documents ?? []).length === 0 && (
            <li className="py-8 text-center text-sm text-[#6F675E]">No documents.</li>
          )}
        </ul>
      </section>

      <section className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-6">
        <p className="text-[10px] uppercase tracking-[0.35em] text-[#C8102E]">Activity log</p>
        <h2 className="mt-2 font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">
          Recent events
        </h2>
        <ul className="mt-4 space-y-4">
          {(activity ?? []).map((row) => (
            <li key={row.id} className="border-l-2 border-[#C8102E]/40 pl-4">
              <p className="font-medium text-[#F7F0E8]">{row.title}</p>
              {row.body ? (
                <p className="mt-1 text-sm text-[#B0A89A]">{row.body}</p>
              ) : null}
              <p className="mt-2 text-[10px] uppercase tracking-wider text-[#6F675E]">
                {row.actor} · {row.event_type}
                {row.deal_id ? (
                  <>
                    {" · "}
                    <Link href={`/ops/deals/${row.deal_id}`} className="text-[#C9A84C] hover:underline">
                      Deal
                    </Link>
                  </>
                ) : null}
                {" · "}
                {row.created_at ? new Date(row.created_at).toLocaleString() : ""}
              </p>
            </li>
          ))}
          {(activity ?? []).length === 0 && (
            <li className="text-sm text-[#6F675E]">No activity yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
