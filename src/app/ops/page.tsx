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

const pipelineStages = [
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

function monthStartIso() {
  const n = new Date();
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), 1)).toISOString();
}

export default async function OpsHomePage() {
  const ctx = await requireOps();
  if ("opsAuthFailed" in ctx && ctx.opsAuthFailed) return null;
  const { supabase, profile, user } = ctx;
  const allowed = await getOpsAllowedClientIds(supabase, user.id, profile?.role);

  const emptyUuid = ["00000000-0000-0000-0000-000000000000"] as string[];

  function scopeClientIdCol<T extends { in: (col: string, ids: string[]) => T }>(q: T): T {
    if (!allowed) return q;
    if (allowed.length === 0) return q.in("client_id", emptyUuid);
    return q.in("client_id", allowed);
  }

  let activeClientsQ = supabase
    .from("clients")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (allowed) {
    if (allowed.length === 0) {
      activeClientsQ = activeClientsQ.in("id", emptyUuid);
    } else {
      activeClientsQ = activeClientsQ.in("id", allowed);
    }
  }

  let pipelineQ = supabase
    .from("deals")
    .select("id", { count: "exact", head: true })
    .in("stage", pipelineStages);
  pipelineQ = allowed
    ? allowed.length === 0
      ? pipelineQ.in("client_id", emptyUuid)
      : pipelineQ.in("client_id", allowed)
    : pipelineQ;

  let draftMsgsQ = supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("requires_review", true)
    .eq("status", "queued");
  draftMsgsQ = scopeClientIdCol(draftMsgsQ);

  let draftDocsQ = supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review");
  draftDocsQ = scopeClientIdCol(draftDocsQ);

  let invoicesRevQ = supabase
    .from("invoices")
    .select("amount_cents")
    .eq("status", "paid")
    .gte("paid_at", monthStartIso());
  invoicesRevQ = scopeClientIdCol(invoicesRevQ);

  const [
    { count: activeClientsCount },
    { count: openEscalationsCount },
    { count: pipelineDealCount },
    { count: draftMsgCount },
    { count: draftDocCount },
    { data: paidInvoices },
    { data: activityRows },
    { data: dealsPreview },
    { data: escalationsPreview },
  ] = await Promise.all([
    activeClientsQ,
    supabase
      .from("escalations")
      .select("id", { count: "exact", head: true })
      .in("status", ["open", "in_review"]),
    pipelineQ,
    draftMsgsQ,
    draftDocsQ,
    invoicesRevQ,
    (async () => {
      let q = supabase
        .from("activity_feed")
        .select("id, client_id, title, body, actor, event_type, created_at")
        .order("created_at", { ascending: false })
        .limit(40);
      if (allowed) {
        if (allowed.length === 0) {
          q = q.in("client_id", emptyUuid);
        } else {
          q = q.in("client_id", allowed);
        }
      }
      return q;
    })(),
    (async () => {
      let q = supabase
        .from("deals")
        .select(
          "id, title, stage, client_id, company_id, updated_at",
        )
        .order("updated_at", { ascending: false })
        .limit(8);
      if (allowed) {
        q =
          allowed.length === 0
            ? q.in("client_id", emptyUuid)
            : q.in("client_id", allowed);
      }
      return q;
    })(),
    supabase
      .from("escalations")
      .select("id, reason, severity, summary, deal_id, created_at")
      .in("status", ["open", "in_review"])
      .limit(40),
  ]);

  function severityRank(s: string) {
    const v = (s ?? "").toLowerCase();
    if (v === "critical") return 0;
    if (v === "high") return 1;
    if (v === "medium") return 2;
    if (v === "low") return 3;
    return 4;
  }

  const escalationsSorted = [...(escalationsPreview ?? [])]
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 5);

  const revenueCents = (paidInvoices ?? []).reduce(
    (s, row) => s + ((row.amount_cents as number) ?? 0),
    0,
  );

  const draftsAwaiting = (draftMsgCount ?? 0) + (draftDocCount ?? 0);

  const actClientIds = Array.from(new Set((activityRows ?? []).map((a) => a.client_id)));
  const dealPrevIds = Array.from(new Set((dealsPreview ?? []).map((d) => d.client_id)));
  const [{ data: actClients }, { data: dealClients }] = await Promise.all([
    actClientIds.length
      ? supabase.from("clients").select("id, name").in("id", actClientIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    dealPrevIds.length
      ? supabase.from("clients").select("id, name").in("id", dealPrevIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const actName = new Map((actClients ?? []).map((c) => [c.id, c.name]));
  const dealCliName = new Map((dealClients ?? []).map((c) => [c.id, c.name]));

  const companyIds = Array.from(
    new Set((dealsPreview ?? []).map((d) => d.company_id).filter(Boolean)),
  ) as string[];
  const { data: companies } = companyIds.length
    ? await supabase.from("companies").select("id, name").in("id", companyIds)
    : { data: [] as { id: string; name: string }[] };
  const coMap = new Map((companies ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#C8102E]">Command center</p>
        <h1 className="mt-3 font-[var(--font-cormorant)] text-4xl font-light tracking-tight text-[#F7F0E8] md:text-5xl">
          Ops dashboard
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#B0A89A]">
          Clairen Haus operator console — pipeline, escalations, approvals, and live onboarding
          completion alerts.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Active clients"
          value={String(activeClientsCount ?? 0)}
          href="/ops/clients"
        />
        <StatCard
          label="Open escalations"
          value={String(openEscalationsCount ?? 0)}
          href="/ops/escalations"
        />
        <StatCard
          label="Deals in pipeline"
          value={String(pipelineDealCount ?? 0)}
          href="/ops/deals"
        />
        <StatCard
          label="Drafts awaiting approval"
          value={String(draftsAwaiting)}
          href="/ops/approvals"
          hint={`${draftMsgCount ?? 0} msgs · ${draftDocCount ?? 0} docs`}
        />
        <StatCard
          label="Revenue this month"
          value={formatUsd(revenueCents)}
          href="/ops/metrics"
        />
      </div>

      <section>
        <p className="mb-3 text-[10px] uppercase tracking-[0.35em] text-[#C9A84C]">Shortcuts</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <QuickLink href="/ops/clients" title="Clients" subtitle="Directory & detail" />
          <QuickLink href="/ops/deals" title="Deal queue" subtitle="Filters & stages" />
          <QuickLink href="/ops/escalations" title="Escalations" subtitle="Severity sorted" />
          <QuickLink href="/ops/approvals" title="Approvals" subtitle="Outbound drafts" />
          <QuickLink href="/ops/audit" title="Audit log" subtitle="Agent runs" />
          <QuickLink href="/ops/metrics" title="Metrics" subtitle="Usage & KPIs" />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#2A211C] bg-[#0B0B0B]">
        <div className="border-b border-[#2A211C] px-4 py-3">
          <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#C9A84C]">
            Recent activity · all clients
          </h2>
        </div>
        <ul className="divide-y divide-[#1D1713]">
          {(activityRows ?? []).map((ev) => (
            <li key={ev.id} className="px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-[#F7F0E8]">{ev.title}</span>
                <span className="text-[10px] uppercase tracking-wider text-[#6F675E]">
                  {ev.created_at ? new Date(ev.created_at).toLocaleString() : ""}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#6F675E]">
                {actName.get(ev.client_id) ?? "Client"} · {ev.actor} · {ev.event_type}
              </p>
              {ev.body ? (
                <p className="mt-1 text-xs text-[#8F8678] line-clamp-2">{ev.body}</p>
              ) : null}
            </li>
          ))}
          {(!activityRows || activityRows.length === 0) && (
            <li className="px-4 py-10 text-center text-sm text-[#6F675E]">
              No activity events yet.
            </li>
          )}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-[#2A211C] bg-[#0B0B0B]">
          <div className="flex items-center justify-between border-b border-[#2A211C] px-4 py-3">
            <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#C9A84C]">Deal queue</h2>
            <Link href="/ops/deals" className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E] hover:text-[#F7F0E8]">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-[#1D1713]">
            {(dealsPreview ?? []).map((deal) => (
              <Link
                key={deal.id}
                href={`/ops/deals/${deal.id}`}
                className="block px-4 py-3 transition hover:bg-[#14100D]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-[#F7F0E8]">
                    {(deal.company_id ? coMap.get(deal.company_id) : null) ?? deal.title}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${stageClass(deal.stage)}`}>
                    {deal.stage}
                  </span>
                </div>
                <p className="mt-1 text-[10px] text-[#6F675E]">
                  {dealCliName.get(deal.client_id)} · updated{" "}
                  {deal.updated_at ? new Date(deal.updated_at).toLocaleString() : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#2A211C] bg-[#0B0B0B]">
          <div className="flex items-center justify-between border-b border-[#2A211C] px-4 py-3">
            <h2 className="text-[11px] uppercase tracking-[0.28em] text-[#C9A84C]">
              Escalations
            </h2>
            <Link href="/ops/escalations" className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E] hover:text-[#F7F0E8]">
              View all →
            </Link>
          </div>
          <ul className="divide-y divide-[#1D1713]">
            {(escalationsSorted ?? []).map((c) => (
              <li key={c.id} className="px-4 py-3">
                <p className="text-sm font-medium text-[#F7F0E8]">
                  {c.reason}{" "}
                  <span className="text-[#C9A84C]">({c.severity})</span>
                </p>
                <p className="mt-1 line-clamp-2 text-xs text-[#8F8678]">{c.summary}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function StatCard({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string;
  href: string;
  hint?: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-4 transition hover:border-[#C9A84C]/35 sm:p-5"
    >
      <p className="text-[10px] uppercase tracking-[0.22em] text-[#6F675E]">{label}</p>
      <p className="mt-2 font-[var(--font-bebas)] text-3xl tracking-wider text-[#C9A84C] sm:text-4xl">
        {value}
      </p>
      {hint ? <p className="mt-1 text-[10px] text-[#5c544a]">{hint}</p> : null}
    </Link>
  );
}

function QuickLink({
  href,
  title,
  subtitle,
}: {
  href: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-[#2A211C] bg-[#080808] px-4 py-3 transition hover:border-[#C8102E]/35"
    >
      <p className="font-medium text-[#F7F0E8]">{title}</p>
      <p className="mt-1 text-xs text-[#6F675E]">{subtitle}</p>
    </Link>
  );
}
