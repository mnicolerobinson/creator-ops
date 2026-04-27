import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  CopyReferralButton,
  LiveActivityFeed,
  SignOutButton,
} from "../portal/dashboard-client";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: access }, { data: profile }] = await Promise.all([
    supabase
      .from("user_clients")
      .select("client_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("user_profiles")
      .select("role, referral_code")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  if (["operator", "superadmin"].includes(profile?.role ?? "")) redirect("/ops");
  if (!access?.client_id) redirect("/login?error=auth");

  const clientId = access.client_id;
  const [{ data: client }, { data: deals }, { data: invoices }, { data: activity }] =
    await Promise.all([
      supabase
        .from("clients")
        .select("id, name, creator_display_name, wizard_step, status")
        .eq("id", clientId)
        .single(),
      supabase
        .from("deals")
        .select(
          "id, title, stage, campaign_type, quoted_amount_cents, due_date, updated_at, company_id, assigned_persona_id",
        )
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("invoices")
        .select("amount_cents, status, paid_at")
        .eq("client_id", clientId),
      supabase
        .from("activity_feed")
        .select("id, event_type, title, body, actor, created_at")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (client && client.status === "onboarding" && (client.wizard_step ?? 1) < 7) {
    redirect(`/onboarding/step-${client.wizard_step ?? 1}`);
  }

  const companyIds = Array.from(
    new Set((deals ?? []).map((deal) => deal.company_id).filter(Boolean)),
  );
  const personaIds = Array.from(
    new Set((deals ?? []).map((deal) => deal.assigned_persona_id).filter(Boolean)),
  );
  const [
    { data: companies },
    { data: personas },
    { data: personaLink },
    { count: referredCount },
    { data: commissions },
  ] = await Promise.all([
    companyIds.length
      ? supabase.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] }),
    personaIds.length
      ? supabase.from("personas").select("id, display_name").in("id", personaIds)
      : Promise.resolve({ data: [] }),
    supabase
      .from("client_personas")
      .select("personas(display_name,title,sending_email)")
      .eq("client_id", clientId)
      .eq("is_primary", true)
      .maybeSingle(),
    supabase
      .from("affiliate_commissions")
      .select("referred_client_id", { count: "exact", head: true })
      .eq("affiliate_user_id", user.id),
    supabase
      .from("affiliate_commissions")
      .select("commission_cents, month_year")
      .eq("affiliate_user_id", user.id),
  ]);

  const accountManager = Array.isArray(personaLink?.personas)
    ? personaLink?.personas[0]
    : personaLink?.personas;
  const companiesById = new Map((companies ?? []).map((company) => [company.id, company.name]));
  const personasById = new Map(
    (personas ?? []).map((persona) => [persona.id, persona.display_name]),
  );
  const terminalStages = new Set(["completed", "declined", "lost"]);
  const activeDeals = (deals ?? []).filter((deal) => !terminalStages.has(deal.stage));
  const totalPipelineValue = activeDeals.reduce(
    (sum, deal) => sum + (deal.quoted_amount_cents ?? 0),
    0,
  );
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const closedThisMonth = (deals ?? []).filter((deal) => {
    if (deal.stage !== "completed" || !deal.updated_at) return false;
    return new Date(deal.updated_at) >= monthStart;
  }).length;
  const revenueCollected = (invoices ?? []).reduce((sum, invoice) => {
    if (invoice.status !== "paid" || !invoice.paid_at) return sum;
    return new Date(invoice.paid_at) >= monthStart
      ? sum + (invoice.amount_cents ?? 0)
      : sum;
  }, 0);
  const monthlyCommission = (commissions ?? []).reduce((sum, commission) => {
    return commission.month_year === monthKey ? sum + (commission.commission_cents ?? 0) : sum;
  }, 0);
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const upcomingDeadlines = activeDeals
    .filter((deal) => {
      if (!deal.due_date) return false;
      const dueDate = new Date(`${deal.due_date}T00:00:00`);
      return dueDate >= now && dueDate <= sevenDaysFromNow;
    })
    .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))
    .slice(0, 6);
  const referralCode = profile?.referral_code ?? user.id.slice(0, 8).toUpperCase();
  const referralLink = `https://creatrops.com/welcome?ref=${referralCode}`;

  return (
    <main className="min-h-screen bg-[#050505] text-[#FAFAFA]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[#2A211C] bg-[#0B0B0B] px-5 py-4 shadow-2xl shadow-black/30">
          <div className="flex items-center gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#C9A84C]/40 bg-[#130D0A]">
              <Image src="/logo.png" alt="CreatrOps" width={40} height={40} />
            </div>
            <div>
              <p className="font-[var(--font-bebas)] text-3xl tracking-[0.2em]">
                Creatr<span className="text-[#C8102E]">Ops</span>
              </p>
              <p className="text-sm text-[#B0A89A]">
                {client?.creator_display_name ?? client?.name ?? "Creator"} dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Notifications"
              className="relative grid h-10 w-10 place-items-center rounded-full border border-[#2A211C] text-[#C9A84C]"
            >
              <span className="text-lg">•</span>
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#C8102E]" />
            </button>
            <SignOutButton />
          </div>
        </header>

        <section className="mt-8 overflow-hidden rounded-[2rem] border border-[#2A211C] bg-[radial-gradient(circle_at_top_right,rgba(201,168,76,0.18),transparent_35%),#090909] p-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#C9A84C]">
                Creator operations
              </p>
              <h1 className="mt-4 max-w-3xl font-[var(--font-cormorant)] text-5xl font-light leading-none md:text-7xl">
                Your brand deals. Finally running themselves.
              </h1>
            </div>
            <div className="h-28 w-full max-w-sm rounded-3xl border border-[#C9A84C]/25 bg-[#0B0B0B]/80 p-4">
              <div className="flex h-full items-end gap-2">
                {[34, 48, 42, 64, 58, 74, 90, 78].map((height, index) => (
                  <div
                    key={index}
                    className="flex-1 rounded-t-full bg-[#C9A84C]"
                    style={{ height: `${height}%`, opacity: 0.35 + index * 0.07 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-4">
          <MetricCard label="Total pipeline value" value={formatCurrency(totalPipelineValue)} />
          <MetricCard label="Active deals" value={String(activeDeals.length)} />
          <MetricCard label="Closed this month" value={String(closedThisMonth)} />
          <MetricCard label="Revenue collected" value={formatCurrency(revenueCollected)} />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.55fr_0.9fr]">
          <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-[#8F8678]">
                  Deal pipeline
                </p>
                <h2 className="mt-2 font-[var(--font-cormorant)] text-3xl">
                  Active opportunities
                </h2>
              </div>
              <Link
                href="/portal/deals"
                className="rounded-full border border-[#C9A84C]/40 px-4 py-2 text-xs uppercase tracking-[0.18em] text-[#C9A84C]"
              >
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="text-xs uppercase tracking-[0.18em] text-[#6F675E]">
                  <tr>
                    <th className="py-3 pr-4">Brand</th>
                    <th className="py-3 pr-4">Campaign type</th>
                    <th className="py-3 pr-4">Value</th>
                    <th className="py-3 pr-4">Stage</th>
                    <th className="py-3 pr-4">Last activity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1D1713]">
                  {activeDeals.map((deal) => (
                    <tr key={deal.id}>
                      <td className="py-4 pr-4">
                        <Link href={`/portal/deals/${deal.id}`} className="text-[#F7F0E8]">
                          {(deal.company_id ? companiesById.get(deal.company_id) : null) ??
                            deal.title}
                        </Link>
                        <p className="mt-1 text-xs text-[#6F675E]">
                          {deal.assigned_persona_id
                            ? personasById.get(deal.assigned_persona_id) ?? "Assigned"
                            : "Review queue"}
                        </p>
                      </td>
                      <td className="py-4 pr-4 text-[#B0A89A]">
                        {deal.campaign_type ?? "Not set"}
                      </td>
                      <td className="py-4 pr-4 text-[#C9A84C]">
                        {formatCurrency(deal.quoted_amount_cents ?? 0)}
                      </td>
                      <td className="py-4 pr-4">
                        <StagePill stage={deal.stage} />
                      </td>
                      <td className="py-4 pr-4 text-[#8F8678]">
                        {deal.updated_at
                          ? new Date(deal.updated_at).toLocaleDateString()
                          : "Pending"}
                      </td>
                    </tr>
                  ))}
                  {activeDeals.length === 0 ? (
                    <tr>
                      <td className="py-10 text-center text-[#8F8678]" colSpan={5}>
                        No active deals yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
              <p className="text-[11px] uppercase tracking-[0.25em] text-[#8F8678]">
                Account manager
              </p>
              <div className="mt-5 flex items-center gap-4">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-[#C8102E] font-[var(--font-cormorant)] text-3xl">
                  {(accountManager?.display_name ?? "Sarah Chen").charAt(0)}
                </div>
                <div>
                  <p className="font-[var(--font-cormorant)] text-3xl">
                    {accountManager?.display_name ?? "Sarah Chen"}
                  </p>
                  <p className="text-sm text-[#B0A89A]">
                    {accountManager?.title ?? "Partnerships Lead"}
                  </p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-[#143D24] bg-[#07150C] p-4 text-sm">
                <p className="flex items-center gap-2 text-emerald-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Currently active
                </p>
                <p className="mt-2 text-[#B0A89A]">
                  {accountManager?.sending_email ?? "sarah@ops.creatrops.com"}
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] uppercase tracking-[0.25em] text-[#8F8678]">
                  Referral snapshot
                </p>
                <CopyReferralButton referralLink={referralLink} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <ReferralStat label="Total referred" value={String(referredCount ?? 0)} />
                <ReferralStat label="Monthly earned" value={formatCurrency(monthlyCommission)} />
              </div>
              <p className="mt-4 truncate rounded-2xl border border-[#2A211C] bg-[#050505] px-4 py-3 text-sm text-[#C9A84C]">
                {referralLink}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#8F8678]">
              Upcoming deadlines
            </p>
            <h2 className="mt-2 font-[var(--font-cormorant)] text-3xl">
              Next 7 days
            </h2>
            <div className="mt-5 space-y-3">
              {upcomingDeadlines.map((deal) => (
                <div
                  key={deal.id}
                  className="rounded-2xl border border-[#2A211C] bg-[#050505] p-4"
                >
                  <p className="text-sm font-medium text-[#F7F0E8]">{deal.title}</p>
                  <p className="mt-1 text-sm text-[#B0A89A]">
                    Due {deal.due_date ? new Date(`${deal.due_date}T00:00:00`).toLocaleDateString() : "soon"}
                  </p>
                </div>
              ))}
              {upcomingDeadlines.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#2A211C] p-5 text-sm text-[#8F8678]">
                  No deliverables due in the next 7 days.
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#8F8678]">
              Live activity
            </p>
            <h2 className="mt-2 font-[var(--font-cormorant)] text-3xl">
              What just happened
            </h2>
            <div className="mt-5 max-h-[520px] overflow-y-auto pr-1">
              <LiveActivityFeed clientId={clientId} initialItems={activity ?? []} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
      <p className="text-[11px] uppercase tracking-[0.22em] text-[#8F8678]">{label}</p>
      <p className="mt-4 font-[var(--font-bebas)] text-5xl tracking-wider text-[#C9A84C]">
        {value}
      </p>
    </div>
  );
}

function ReferralStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#2A211C] bg-[#050505] p-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-[#6F675E]">{label}</p>
      <p className="mt-3 text-xl font-semibold text-[#F7F0E8]">{value}</p>
    </div>
  );
}

function StagePill({ stage }: { stage: string }) {
  const color =
    stage === "completed" || stage === "paid"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : stage === "declined" || stage === "lost"
        ? "border-zinc-500/30 bg-zinc-700/30 text-zinc-300"
        : "border-[#C8102E]/40 bg-[#C8102E]/15 text-[#FFCED6]";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs capitalize ${color}`}>
      {stage.replace(/_/g, " ")}
    </span>
  );
}
