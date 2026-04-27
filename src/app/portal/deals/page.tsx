import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireCreator } from "@/lib/auth/guards";

const STAGE_TABS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "qualifying", label: "Qualifying" },
  { key: "qualified", label: "Qualified" },
  { key: "negotiating", label: "Negotiating" },
  { key: "contract", label: "Contract" },
  { key: "invoiced", label: "Invoiced" },
  { key: "completed", label: "Completed" },
] as const;

const TAB_TO_STAGES: Record<string, string[] | null> = {
  all: null,
  new: ["new"],
  qualifying: ["qualifying"],
  qualified: ["qualified"],
  negotiating: ["negotiating"],
  contract: [
    "contract_draft",
    "contract_sent",
    "contract_signed",
    "in_production",
    "deliverables_submitted",
  ],
  invoiced: ["invoiced", "paid"],
  completed: ["completed"],
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
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

export default async function PortalDealsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; q?: string }>;
}) {
  const { supabase, clientAccess } = await requireCreator();
  const clientId = clientAccess?.client_id;
  if (!clientId) redirect("/login?error=auth");

  const sp = await searchParams;
  const stageKey = STAGE_TABS.some((t) => t.key === sp.stage) ? sp.stage! : "all";
  const q = (sp.q ?? "").trim().toLowerCase();

  const { data: deals } = await supabase
    .from("deals")
    .select(
      "id, title, stage, campaign_type, quoted_amount_cents, due_date, updated_at, company_id, assigned_persona_id",
    )
    .eq("client_id", clientId)
    .order("updated_at", { ascending: false });

  const companyIds = Array.from(
    new Set((deals ?? []).map((deal) => deal.company_id).filter(Boolean)),
  ) as string[];
  const personaIds = Array.from(
    new Set((deals ?? []).map((deal) => deal.assigned_persona_id).filter(Boolean)),
  ) as string[];

  const [{ data: companies }, { data: personas }] = await Promise.all([
    companyIds.length
      ? supabase.from("companies").select("id, name").in("id", companyIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    personaIds.length
      ? supabase.from("personas").select("id, display_name").in("id", personaIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string }[] }),
  ]);

  const companiesById = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const personasById = new Map((personas ?? []).map((p) => [p.id, p.display_name]));

  const allowedStages = TAB_TO_STAGES[stageKey];
  let filtered = deals ?? [];
  if (allowedStages) {
    filtered = filtered.filter((d) => allowedStages.includes(d.stage));
  }
  if (q) {
    filtered = filtered.filter((d) => {
      const brand =
        (d.company_id ? companiesById.get(d.company_id) : null) ?? d.title ?? "";
      const hay = `${brand} ${d.title ?? ""} ${d.campaign_type ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }

  function hrefForTab(key: string) {
    const params = new URLSearchParams();
    if (key !== "all") params.set("stage", key);
    if (q) params.set("q", sp.q ?? "");
    const s = params.toString();
    return s ? `/portal/deals?${s}` : "/portal/deals";
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-xs uppercase tracking-[0.2em] text-[#8F8678] transition hover:text-[#C9A84C]"
            >
              ← Dashboard
            </Link>
            <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[#C9A84C]/40 bg-[#130D0A]">
              <Image src="/logo.png" alt="CreatrOps" width={40} height={40} />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.35em] text-[#C9A84C]">
                Deal pipeline
              </p>
              <h1 className="font-[var(--font-cormorant)] text-4xl font-light text-[#F7F0E8]">
                All deals
              </h1>
            </div>
          </div>
        </header>

        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <nav className="flex flex-wrap gap-2">
            {STAGE_TABS.map((tab) => {
              const active = stageKey === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={hrefForTab(tab.key)}
                  className={`rounded-full px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] transition ${
                    active
                      ? "bg-[#C8102E] text-white"
                      : "border border-[#2A211C] bg-[#0B0B0B] text-[#B0A89A] hover:border-[#C9A84C]/40"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>

          <form action="/portal/deals" method="get" className="flex w-full max-w-md gap-2">
            {stageKey !== "all" ? (
              <input type="hidden" name="stage" value={stageKey} />
            ) : null}
            <input
              type="search"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search brand or campaign…"
              className="min-w-0 flex-1 rounded-2xl border border-[#2A211C] bg-[#050505] px-4 py-3 text-sm text-[#F7F0E8] placeholder:text-[#6F675E] outline-none focus:border-[#C9A84C]/50"
            />
            <button
              type="submit"
              className="rounded-2xl bg-[#C8102E] px-5 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white"
            >
              Search
            </button>
          </form>
        </div>

        <div className="overflow-hidden rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
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
                {filtered.map((deal) => (
                  <tr key={deal.id}>
                    <td className="py-4 pr-4">
                      <Link href={`/portal/deals/${deal.id}`} className="text-[#F7F0E8] hover:text-[#C9A84C]">
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
                {filtered.length === 0 ? (
                  <tr>
                    <td className="py-14 text-center text-[#8F8678]" colSpan={5}>
                      No deals match your filters.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
