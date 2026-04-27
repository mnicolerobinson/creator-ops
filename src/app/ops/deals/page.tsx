import Link from "next/link";
import { requireOps } from "@/lib/auth/guards";
import { getOpsAllowedClientIds } from "@/lib/ops/client-access";
import { DealStageControl } from "./deal-stage-control";
import { DealsToolbar } from "./toolbar";

function fmtMoney(cents: number | null | undefined, currency: string) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function OpsDealsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string; client?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, profile, user } = await requireOps();
  const allowed = await getOpsAllowedClientIds(supabase, user.id, profile?.role);

  const emptyUuid = "00000000-0000-0000-0000-000000000000";

  let clientListQuery = supabase
    .from("clients")
    .select("id, creator_display_name, name")
    .order("creator_display_name");
  if (allowed) {
    if (allowed.length === 0) {
      clientListQuery = clientListQuery.in("id", [emptyUuid]);
    } else {
      clientListQuery = clientListQuery.in("id", allowed);
    }
  }
  const { data: clientRows } = await clientListQuery;

  let q = supabase
    .from("deals")
    .select(
      `
      id,
      title,
      stage,
      qualification_reason,
      qualification_score,
      updated_at,
      client_id,
      campaign_type,
      quoted_amount_cents,
      currency,
      due_date,
      companies ( name )
    `,
    )
    .order("updated_at", { ascending: false })
    .limit(400);

  if (allowed) {
    if (allowed.length === 0) {
      q = q.in("client_id", [emptyUuid]);
    } else {
      q = q.in("client_id", allowed);
    }
  }

  if (sp.stage) {
    q = q.eq("stage", sp.stage);
  }
  if (sp.client) {
    q = q.eq("client_id", sp.client);
  }

  const fromIso =
    sp.from && sp.from.trim()
      ? new Date(`${sp.from.trim()}T00:00:00.000Z`).toISOString()
      : null;
  const toIso =
    sp.to && sp.to.trim()
      ? new Date(`${sp.to.trim()}T23:59:59.999Z`).toISOString()
      : null;
  if (fromIso) {
    q = q.gte("updated_at", fromIso);
  }
  if (toIso) {
    q = q.lte("updated_at", toIso);
  }

  const { data: deals } = await q;

  const cids = Array.from(new Set((deals ?? []).map((d) => d.client_id)));
  const { data: clients } = cids.length
    ? await supabase.from("clients").select("id, name, creator_display_name").in("id", cids)
    : { data: [] as { id: string; name: string; creator_display_name: string }[] };

  const cMap = new Map((clients ?? []).map((c) => [c.id, c]));

  const toolbarClients = (clientRows ?? []).map((c) => ({
    id: c.id,
    label: c.creator_display_name || c.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#C8102E]">CRM</p>
        <h1 className="mt-3 font-[var(--font-cormorant)] text-4xl font-light text-[#F7F0E8]">
          Deal queue
        </h1>
        <p className="mt-2 text-sm text-[#8F8678]">
          All opportunities across creator accounts in your scope — filter and advance stages inline.
        </p>
      </div>

      <DealsToolbar clients={toolbarClients} />

      <div className="overflow-hidden rounded-2xl border border-[#2A211C] bg-[#0B0B0B]">
        <div className="hidden grid-cols-12 border-b border-[#2A211C] px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[#6F675E] xl:grid">
          <div className="col-span-2">Client</div>
          <div className="col-span-2">Brand</div>
          <div className="col-span-2">Campaign</div>
          <div className="col-span-1">Value</div>
          <div className="col-span-2">Stage</div>
          <div className="col-span-1">Qual.</div>
          <div className="col-span-1">Updated</div>
          <div className="col-span-1">Due</div>
        </div>
        <div className="divide-y divide-[#1D1713]">
          {(deals ?? []).map((d) => {
            const c = cMap.get(d.client_id);
            const brandRaw = (d as { companies?: { name?: string } | { name?: string }[] | null })
              .companies;
            const brandName = Array.isArray(brandRaw)
              ? brandRaw[0]?.name
              : brandRaw?.name;
            return (
              <div
                key={d.id}
                className="grid grid-cols-1 gap-3 px-4 py-4 text-sm xl:grid-cols-12 xl:items-center"
              >
                <div className="xl:col-span-2">
                  <Link
                    href={`/ops/clients/${d.client_id}`}
                    className="block font-medium text-[#F7F0E8] hover:text-[#C9A84C]"
                  >
                    {c?.creator_display_name ?? c?.name ?? "—"}
                  </Link>
                  <Link
                    href={`/ops/deals/${d.id}`}
                    className="mt-1 block text-xs text-[#C9A84C] hover:underline"
                  >
                    {d.title}
                  </Link>
                </div>
                <div className="text-xs text-[#B0A89A] xl:col-span-2">{brandName ?? "—"}</div>
                <div className="text-xs text-[#B0A89A] xl:col-span-2">{d.campaign_type ?? "—"}</div>
                <div className="text-xs text-[#C9A84C] xl:col-span-1">
                  {fmtMoney(d.quoted_amount_cents, d.currency)}
                </div>
                <div className="xl:col-span-2">
                  <DealStageControl dealId={d.id} stage={d.stage} />
                </div>
                <div className="text-xs text-[#C9A84C] xl:col-span-1">
                  {d.qualification_score != null
                    ? Number(d.qualification_score).toFixed(2)
                    : "—"}
                </div>
                <div className="text-xs text-[#6F675E] xl:col-span-1">
                  {d.updated_at ? new Date(d.updated_at).toLocaleDateString() : "—"}
                </div>
                <div className="text-xs text-[#6F675E] xl:col-span-1">
                  {d.due_date ? new Date(d.due_date).toLocaleDateString() : "—"}
                </div>
              </div>
            );
          })}
        </div>
        {(!deals || deals.length === 0) && (
          <p className="px-4 py-12 text-center text-sm text-[#6F675E]">
            No deals match these filters.
          </p>
        )}
      </div>
    </div>
  );
}
