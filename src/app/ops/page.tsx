import Link from "next/link";
import { requireOps } from "@/lib/auth/guards";
import { getOpsAllowedClientIds } from "@/lib/ops/client-access";

function stageClass(stage: string) {
  if (stage === "new") return "border-[#C8102E]/40 bg-[#C8102E]/15 text-[#FFCED6]";
  if (stage === "qualified" || stage === "negotiating")
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (stage === "declined" || stage === "lost")
    return "border-zinc-500/30 bg-zinc-700/30 text-zinc-300";
  return "border-[#B0A89A]/30 bg-[#B0A89A]/10 text-[#F7F0E8]";
}

export default async function OpsHomePage() {
  const { supabase, profile, user } = await requireOps();
  const allowed = await getOpsAllowedClientIds(supabase, user.id, profile?.role);

  let dealsQuery = supabase
    .from("deals")
    .select(
      "id, title, stage, campaign_type, created_at, client_id, company_id, assigned_persona_id, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(40);

  if (allowed) {
    if (allowed.length === 0) {
      dealsQuery = dealsQuery.in("client_id", [
        "00000000-0000-0000-0000-000000000000",
      ] as string[]);
    } else {
      dealsQuery = dealsQuery.in("client_id", allowed);
    }
  }

  let clientsQuery = supabase
    .from("clients")
    .select(
      "id, name, creator_display_name, status, subscription_tier, wizard_step, created_at, onboarding_completed_at",
    )
    .order("created_at", { ascending: false })
    .limit(12);

  if (allowed) {
    if (allowed.length === 0) {
      clientsQuery = clientsQuery.in("id", [
        "00000000-0000-0000-0000-000000000000",
      ] as string[]);
    } else {
      clientsQuery = clientsQuery.in("id", allowed);
    }
  }

  let messagesQuery = supabase
    .from("messages")
    .select("id, client_id, deal_id, subject, body_text, status, created_at, requires_review")
    .eq("requires_review", true)
    .order("created_at", { ascending: false })
    .limit(15);

  if (allowed) {
    if (allowed.length === 0) {
      messagesQuery = messagesQuery.in("client_id", [
        "00000000-0000-0000-0000-000000000000",
      ] as string[]);
    } else {
      messagesQuery = messagesQuery.in("client_id", allowed);
    }
  }

  const activeStages = [
    "new",
    "qualifying",
    "qualified",
    "negotiating",
    "contract_draft",
    "contract_sent",
    "contract_signed",
    "in_production",
    "deliverables_submitted",
    "invoiced",
  ] as const;

  let activeDealCountQ = supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .in("stage", activeStages);
  if (allowed) {
    if (allowed.length === 0) {
      activeDealCountQ = activeDealCountQ.in("client_id", [
        "00000000-0000-0000-0000-000000000000",
      ] as string[]);
    } else {
      activeDealCountQ = activeDealCountQ.in("client_id", allowed);
    }
  }

  let clientTotalQ = supabase.from("clients").select("id", { count: "exact", head: true });
  if (allowed) {
    if (allowed.length === 0) {
      clientTotalQ = clientTotalQ.in("id", [
        "00000000-0000-0000-0000-000000000000",
      ] as string[]);
    } else {
      clientTotalQ = clientTotalQ.in("id", allowed);
    }
  }

  const [
    { data: deals },
    { data: clients },
    { data: approvalMessages },
    { count: openEscalationCount },
    { count: clientTotalCount },
    { count: activeDealCount },
  ] = await Promise.all([
    dealsQuery,
    clientsQuery,
    messagesQuery,
    supabase
      .from("escalations")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_review"]),
    clientTotalQ,
    activeDealCountQ,
  ]);

  const { data: escalations } = await supabase
    .from("escalations")
    .select("id, reason, severity, status, summary, created_at, deal_id")
    .in("status", ["open", "in_review"])
    .order("created_at", { ascending: false })
    .limit(8);
  const companyIds = Array.from(
    new Set((deals ?? []).map((d) => d.company_id).filter(Boolean)),
  ) as string[];
  const personaIds = Array.from(
    new Set((deals ?? []).map((d) => d.assigned_persona_id).filter(Boolean)),
  ) as string[];
  const msgClientIds = Array.from(
    new Set((approvalMessages ?? []).map((m) => m.client_id)),
  );

  const dealClientIds = Array.from(new Set((deals ?? []).map((d) => d.client_id)));

  const [
    { data: companies },
    { data: personas },
    { data: messageClients },
    { data: dealClients },
  ] = await Promise.all([
    companyIds.length
      ? supabase.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    personaIds.length
      ? supabase.from("personas").select("id, display_name").in("id", personaIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
    msgClientIds.length
      ? supabase.from("clients").select("id, name").in("id", msgClientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    dealClientIds.length
      ? supabase.from("clients").select("id, name").in("id", dealClientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const companiesById = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const personasById = new Map(
    (personas ?? []).map((p) => [p.id, p.display_name]),
  );
  const clientsById = new Map(
    (messageClients ?? []).map((c) => [c.id, c.name]),
  );
  const clientsNameById = new Map((dealClients ?? []).map((c) => [c.id, c.name]));

  const openEscalationsN = openEscalationCount ?? 0;
  const pendingApprovals = approvalMessages?.length ?? 0;

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#C8102E]">Command center</p>
        <h1 className="mt-3 font-[var(--font-cormorant)] text-4xl font-light tracking-tight text-[#F7F0E8] md:text-5xl">
          Ops console
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#B0A89A]">
          Pipeline, escalations, and outbound message review. New creator signups appear in the
          live feed (bottom-right) when you have access to the account.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Clients (in scope)"
          value={String(clientTotalCount ?? 0)}
          href="/ops/clients"
        />
        <StatCard
          label="Open deals (in pipeline)"
          value={String(activeDealCount ?? 0)}
          href="/ops/deals"
        />
        <StatCard
          label="Open escalations"
          value={String(openEscalationsN)}
          href="/ops/escalations"
        />
        <StatCard
          label="Messages awaiting approval"
          value={String(pendingApprovals)}
          href="/ops/messages"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-[#2A211C] bg-[#0B0B0B] shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-[#2A211C] px-4 py-3">
            <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#C9A84C]">Deal queue</h2>
            <Link
              href="/ops/deals"
              className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E] hover:text-[#F7F0E8]"
            >
              View all →
            </Link>
          </div>
          <div className="divide-y divide-[#1D1713]">
            {(deals ?? []).slice(0, 8).map((deal) => {
              const brandName =
                (deal.company_id ? companiesById.get(deal.company_id) : null) ?? deal.title;
              const persona =
                (deal.assigned_persona_id
                  ? personasById.get(deal.assigned_persona_id)
                  : null) ?? "—";
              return (
                <Link
                  key={deal.id}
                  href={`/ops/deals/${deal.id}`}
                  className="block px-4 py-3.5 transition hover:bg-[#14100D]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium text-[#F7F0E8]">{brandName}</p>
                      <p className="text-xs text-[#6F675E]">
                        {clientsNameById.get(deal.client_id) ?? "Client"}
                        {deal.campaign_type ? ` · ${deal.campaign_type}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${stageClass(deal.stage)}`}
                    >
                      {deal.stage}
                    </span>
                  </div>
                  <p className="mt-1.5 text-[10px] text-[#6F675E]">Persona: {persona}</p>
                </Link>
              );
            })}
            {(!deals || deals.length === 0) && (
              <p className="px-4 py-10 text-center text-sm text-[#6F675E]">No deals in view.</p>
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#2A211C] bg-[#0B0B0B] shadow-2xl shadow-black/20">
          <div className="flex items-center justify-between border-b border-[#2A211C] px-4 py-3">
            <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#C9A84C]">
              Escalation queue
            </h2>
            <Link
              href="/ops/escalations"
              className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E] hover:text-[#F7F0E8]"
            >
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-[#1D1713]">
            {(escalations ?? []).map((c) => (
              <li key={c.id} className="px-4 py-3.5">
                <p className="text-sm font-medium text-[#F7F0E8]">
                  {c.reason}
                  <span className="ml-2 text-xs font-normal text-[#6F675E]">· sev {c.severity}</span>
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-[#8F8678]">{c.summary}</p>
                <p className="mt-1.5 text-[10px] text-[#6F675E]">
                  {c.deal_id ? (
                    <Link
                      href={`/ops/deals/${c.deal_id}`}
                      className="text-[#C9A84C] hover:underline"
                    >
                      Open deal
                    </Link>
                  ) : (
                    "No deal"
                  )}
                  {" · "}
                  {c.status}
                </p>
              </li>
            ))}
            {(!escalations || escalations.length === 0) && (
              <li className="px-4 py-10 text-center text-sm text-[#6F675E]">
                No open escalations.
              </li>
            )}
          </ul>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-[#2A211C] bg-[#0B0B0B]">
        <div className="flex items-center justify-between border-b border-[#2A211C] px-4 py-3">
          <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#C9A84C]">
            Message approval
          </h2>
          <Link
            href="/ops/messages"
            className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E] hover:text-[#F7F0E8]"
          >
            Full queue →
          </Link>
        </div>
        <div className="grid grid-cols-12 border-b border-[#1D1713] px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
          <div className="col-span-3">Client</div>
          <div className="col-span-4">Subject / preview</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Received</div>
          <div className="col-span-1 text-right" />
        </div>
        <div className="divide-y divide-[#1D1713]">
          {(approvalMessages ?? []).slice(0, 6).map((m) => (
            <div
              key={m.id}
              className="grid grid-cols-12 items-start gap-2 px-4 py-3 text-sm"
            >
              <div className="col-span-3 text-[#B0A89A]">
                {clientsById.get(m.client_id) ?? "—"}
              </div>
              <div className="col-span-4">
                <p className="line-clamp-1 font-medium text-[#F7F0E8]">
                  {m.subject?.trim() || "(No subject)"}
                </p>
                <p className="line-clamp-1 text-xs text-[#6F675E]">
                  {(m.body_text ?? "").slice(0, 100)}
                </p>
              </div>
              <div className="col-span-2 text-xs text-[#8F8678]">{m.status}</div>
              <div className="col-span-2 text-xs text-[#6F675E]">
                {m.created_at ? new Date(m.created_at).toLocaleString() : "—"}
              </div>
              <div className="col-span-1 text-right">
                {m.deal_id ? (
                  <Link
                    href={`/ops/deals/${m.deal_id}`}
                    className="text-[10px] uppercase tracking-wider text-[#C9A84C] hover:underline"
                  >
                    Deal
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
          {(!approvalMessages || approvalMessages.length === 0) && (
            <p className="px-4 py-10 text-center text-sm text-[#6F675E]">
              No outbound messages pending review.
            </p>
          )}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#C9A84C]">Recent clients</h2>
          <Link
            href="/ops/clients"
            className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E] hover:text-[#F7F0E8]"
          >
            All clients →
          </Link>
        </div>
        <div className="overflow-hidden rounded-2xl border border-[#2A211C] bg-[#0B0B0B]">
          <div className="grid grid-cols-12 border-b border-[#1D1713] px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
            <div className="col-span-4">Creator</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Plan</div>
            <div className="col-span-1">Step</div>
            <div className="col-span-2 text-right">Joined</div>
          </div>
          <div className="divide-y divide-[#1D1713]">
            {(clients ?? []).map((c) => (
              <div key={c.id} className="grid grid-cols-12 items-center gap-2 px-4 py-3 text-sm">
                <div className="col-span-4">
                  <p className="font-medium text-[#F7F0E8]">{c.creator_display_name}</p>
                  <p className="text-xs text-[#6F675E]">{c.name}</p>
                </div>
                <div className="col-span-2 text-xs text-[#B0A89A]">{c.status}</div>
                <div className="col-span-3 text-xs text-[#8F8678]">
                  {c.subscription_tier?.replace(/_/g, " ") ?? "—"}
                </div>
                <div className="col-span-1 text-xs text-[#6F675E]">{c.wizard_step ?? 1}/7</div>
                <div className="col-span-2 text-right text-xs text-[#6F675E]">
                  {c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}
                </div>
              </div>
            ))}
            {(!clients || clients.length === 0) && (
              <p className="px-4 py-10 text-center text-sm text-[#6F675E]">
                No client workspaces in your scope. Superadmin sees all; operators are scoped via
                assignments.
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-5 transition hover:border-[#C9A84C]/35"
    >
      <p className="text-[10px] uppercase tracking-[0.25em] text-[#6F675E]">{label}</p>
      <p className="mt-3 font-[var(--font-bebas)] text-4xl tracking-wider text-[#C9A84C]">
        {value}
      </p>
    </Link>
  );
}
