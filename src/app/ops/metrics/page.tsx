import { requireOps } from "@/lib/auth/guards";
import {
  isSubscriptionTierKey,
  monthlyLlmBudgetCentsForTier,
  subscriptionTiers,
} from "@/lib/billing/tiers";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AgentRunRow = {
  client_id: string;
  agent_name: string;
  llm_cost_cents: string | number | null;
  started_at: string;
};

function monthUtcRange() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999),
  );
  return { start, end };
}

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function budgetFromPolicy(policyJson: unknown, tierDefaultCents: number): number {
  if (!policyJson || typeof policyJson !== "object") return tierDefaultCents;
  const o = policyJson as Record<string, unknown>;
  const direct = o.monthly_llm_budget_cents;
  if (typeof direct === "number" && direct > 0) return direct;
  const om = o.ops_metrics;
  if (om && typeof om === "object") {
    const v = (om as Record<string, unknown>).monthly_llm_budget_cents;
    if (typeof v === "number" && v > 0) return v;
  }
  return tierDefaultCents;
}

function formatUsd(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function tierDisplayName(tier: string | null | undefined): string {
  if (tier && isSubscriptionTierKey(tier)) {
    return subscriptionTiers[tier].name;
  }
  return "Unknown tier";
}

export default async function OpsMetricsPage() {
  await requireOps();
  const client = await createServerSupabaseClient();
  const { start, end } = monthUtcRange();
  const monthLabel = start.toLocaleString("en-US", { month: "long", year: "numeric" });

  const capStarter = subscriptionTiers.starter_ops.monthlyLlmBudgetCents;
  const capGrowth = subscriptionTiers.growth_ops.monthlyLlmBudgetCents;
  const capCeo = subscriptionTiers.creator_ceo.monthlyLlmBudgetCents;
  const envFallbackCents = Number(process.env.CREATOR_LLM_MONTHLY_BUDGET_CENTS);
  const hasEnvFallback = Number.isFinite(envFallbackCents) && envFallbackCents > 0;

  const { data: runs } = await client
    .from("agent_runs")
    .select("client_id, agent_name, llm_cost_cents, started_at")
    .gte("started_at", start.toISOString())
    .lte("started_at", end.toISOString());

  const { data: clients } = await client
    .from("clients")
    .select("id, name, creator_display_name, subscription_tier");

  const { data: policies } = await client.from("client_policies").select("client_id, policy_json");

  const policyJsonByClient = new Map<string, unknown>(
    (policies ?? []).map((p) => [p.client_id, p.policy_json]),
  );

  const clientName = new Map(
    (clients ?? []).map((c) => [c.id, c.creator_display_name || c.name || c.id]),
  );

  const spendByClient = new Map<string, number>();
  const spendByAgent = new Map<string, number>();
  let totalCents = 0;

  for (const r of (runs ?? []) as AgentRunRow[]) {
    const c = toNum(r.llm_cost_cents);
    totalCents += c;
    spendByClient.set(r.client_id, (spendByClient.get(r.client_id) ?? 0) + c);
    spendByAgent.set(r.agent_name, (spendByAgent.get(r.agent_name) ?? 0) + c);
  }

  const clientRows = (clients ?? []).map((cl) => {
    const spend = spendByClient.get(cl.id) ?? 0;
    const tierDefault = monthlyLlmBudgetCentsForTier(cl.subscription_tier);
    const budget = budgetFromPolicy(policyJsonByClient.get(cl.id), tierDefault);
    const pct = budget > 0 ? (spend / budget) * 100 : 0;
    return {
      id: cl.id,
      name: clientName.get(cl.id) ?? cl.id,
      tierLabel: tierDisplayName(cl.subscription_tier),
      spend,
      budget,
      pct,
      nearLimit: pct >= 90,
    };
  });
  clientRows.sort((a, b) => b.spend - a.spend);

  const maxSpend = Math.max(1, ...clientRows.map((r) => r.spend), 1);
  const agentRows = Array.from(spendByAgent.entries())
    .map(([agent_name, spend]) => ({ agent_name, spend }))
    .sort((a, b) => b.spend - a.spend);

  const { count: scamEscalations } = await client
    .from("escalations")
    .select("id", { count: "exact", head: true })
    .eq("reason", "policy_violation")
    .ilike("summary", "[Scam / spam filter]%")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  const { count: safetyEvents } = await client
    .from("activity_feed")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "intake.safety_escalation")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  const { count: routineIgnored } = await client
    .from("activity_feed")
    .select("id", { count: "exact", head: true })
    .eq("event_type", "intake.email_ignored")
    .gte("created_at", start.toISOString())
    .lte("created_at", end.toISOString());

  return (
    <div className="space-y-10">
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#C8102E]">Operations</p>
        <h1 className="mt-2 font-[var(--font-cormorant)] text-4xl text-[#F7F0E8]">Cost &amp; safety metrics</h1>
        <p className="mt-2 text-sm text-[#8F8678]">
          {monthLabel} (UTC) · default monthly LLM caps by tier: Starter Ops {formatUsd(capStarter)}, Growth Ops{" "}
          {formatUsd(capGrowth)}, Creator CEO {formatUsd(capCeo)} — overridden per client via{" "}
          <code className="text-[#C9A84C]">client_policies.policy_json.monthly_llm_budget_cents</code>
          {hasEnvFallback ? (
            <>
              {" "}
              · if <code className="text-[#C9A84C]">subscription_tier</code> is missing, env fallback{" "}
              {formatUsd(envFallbackCents)} applies
            </>
          ) : null}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">Platform LLM spend (month)</p>
          <p className="mt-3 font-[var(--font-bebas)] text-4xl tracking-wider text-[#C9A84C]">
            {formatUsd(totalCents)}
          </p>
        </div>
        <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">Scam / spam escalations</p>
          <p className="mt-3 font-[var(--font-bebas)] text-4xl tracking-wider text-[#C9A84C]">
            {scamEscalations ?? 0}
          </p>
          <p className="mt-1 text-xs text-[#8F8678]">policy_violation + intake safety summary</p>
        </div>
        <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">Safety review events</p>
          <p className="mt-3 font-[var(--font-bebas)] text-4xl tracking-wider text-[#C9A84C]">
            {safetyEvents ?? 0}
          </p>
          <p className="mt-1 text-xs text-[#8F8678]">intake.safety_escalation activity</p>
        </div>
        <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
          <p className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">Routine inbox ignored</p>
          <p className="mt-3 font-[var(--font-bebas)] text-4xl tracking-wider text-[#C9A84C]">
            {routineIgnored ?? 0}
          </p>
          <p className="mt-1 text-xs text-[#8F8678]">Spam / OOO (intake.email_ignored)</p>
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-6">
          <h2 className="font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">Cost per client</h2>
          <p className="mt-1 text-sm text-[#8F8678]">LLM cost from agent_runs.llm_cost_cents (month)</p>
          <div className="mt-6 space-y-4">
            {clientRows.length === 0 ? (
              <p className="text-sm text-[#8F8678]">No clients yet.</p>
            ) : (
              clientRows.map((row) => (
                <div key={row.id}>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex flex-wrap items-center gap-2 text-[#F7F0E8]">
                      {row.name}
                      <span className="text-[10px] uppercase tracking-wide text-[#6F675E]">
                        ({row.tierLabel})
                      </span>
                      {row.nearLimit ? (
                        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                          ≥90% budget
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-[#C9A84C]">{formatUsd(row.spend)}</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-[#14120F]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#6B5420] to-[#C9A84C]"
                      style={{ width: `${(row.spend / maxSpend) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-6">
          <h2 className="font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">Agent breakdown</h2>
          <p className="mt-1 text-sm text-[#8F8678]">By agent_name on agent_runs</p>
          <ul className="mt-5 space-y-3">
            {agentRows.length === 0 ? (
              <li className="text-sm text-[#8F8678]">No data.</li>
            ) : (
              agentRows.map((a) => (
                <li
                  key={a.agent_name}
                  className="flex items-center justify-between rounded-2xl border border-[#1D1713] bg-[#050505] px-4 py-3 text-sm"
                >
                  <span className="font-medium text-[#F7F0E8]">{a.agent_name}</span>
                  <span className="text-[#C9A84C]">{formatUsd(a.spend)}</span>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>

      <section className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-6">
        <h2 className="font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">Budget utilization by client</h2>
        <p className="mt-1 text-sm text-[#8F8678]">
          Percent of monthly limit — tier default unless{" "}
          <code className="text-[#C9A84C]">policy_json.monthly_llm_budget_cents</code> overrides
        </p>
        <div className="mt-6 space-y-4">
          {clientRows.length === 0 ? (
            <p className="text-sm text-[#8F8678]">No data.</p>
          ) : (
            clientRows.map((row) => {
              const width = Math.min(100, row.pct);
              const alert = row.pct >= 90;
              return (
                <div key={row.id}>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="text-[#F7F0E8]">
                      {row.name}{" "}
                      <span className="text-[#6F675E]">({row.tierLabel})</span>
                    </span>
                    <span className={alert ? "font-semibold text-amber-200" : "text-[#B0A89A]"}>
                      {row.pct.toFixed(0)}% · {formatUsd(row.spend)} / {formatUsd(row.budget)}
                    </span>
                  </div>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#14120F]">
                    <div
                      className={`h-full rounded-full ${
                        alert ? "bg-amber-500" : "bg-[#C9A84C]"
                      }`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
