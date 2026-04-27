import Link from "next/link";
import { requireOps } from "@/lib/auth/guards";
import { getOpsAllowedClientIds } from "@/lib/ops/client-access";

export default async function OpsDealsPage() {
  const { supabase, profile, user } = await requireOps();
  const allowed = await getOpsAllowedClientIds(supabase, user.id, profile?.role);

  let q = supabase
    .from("deals")
    .select(
      "id, title, stage, qualification_reason, qualification_score, updated_at, client_id, campaign_type",
    )
    .order("updated_at", { ascending: false })
    .limit(200);

  if (allowed) {
    if (allowed.length === 0) {
      q = q.in("client_id", ["00000000-0000-0000-0000-000000000000"] as string[]);
    } else {
      q = q.in("client_id", allowed);
    }
  }

  const { data: deals } = await q;
  const cids = Array.from(new Set((deals ?? []).map((d) => d.client_id)));
  const { data: clients } = cids.length
    ? await supabase.from("clients").select("id, name, creator_display_name").in("id", cids)
    : { data: [] as { id: string; name: string; creator_display_name: string }[] };

  const cMap = new Map((clients ?? []).map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#C8102E]">CRM</p>
        <h1 className="mt-3 font-[var(--font-cormorant)] text-4xl font-light text-[#F7F0E8]">
          Deal queue
        </h1>
        <p className="mt-2 text-sm text-[#8F8678]">
          All opportunities across creator accounts in your scope.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#2A211C] bg-[#0B0B0B]">
        <div className="grid grid-cols-12 border-b border-[#2A211C] px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
          <div className="col-span-4">Deal</div>
          <div className="col-span-2">Client</div>
          <div className="col-span-2">Stage</div>
          <div className="col-span-2">Qualification</div>
          <div className="col-span-1">Fit</div>
          <div className="col-span-1 text-right">Updated</div>
        </div>
        <div className="divide-y divide-[#1D1713]">
          {(deals ?? []).map((d) => {
            const c = cMap.get(d.client_id);
            return (
              <Link
                key={d.id}
                href={`/ops/deals/${d.id}`}
                className="grid grid-cols-12 items-center gap-2 px-4 py-3.5 text-sm transition hover:bg-[#14100D]"
              >
                <div className="col-span-4 font-medium text-[#F7F0E8]">{d.title}</div>
                <div className="col-span-2 text-xs text-[#B0A89A]">
                  {c?.creator_display_name ?? c?.name ?? "—"}
                </div>
                <div className="col-span-2">
                  <span className="rounded-full border border-[#C8102E]/35 bg-[#C8102E]/10 px-2.5 py-0.5 text-xs text-[#FFCED6]">
                    {d.stage}
                  </span>
                </div>
                <div className="col-span-2 line-clamp-2 text-xs text-[#8F8678]">
                  {d.qualification_reason ?? "—"}
                </div>
                <div className="col-span-1 text-xs text-[#C9A84C]">
                  {d.qualification_score != null
                    ? Number(d.qualification_score).toFixed(2)
                    : "—"}
                </div>
                <div className="col-span-1 text-right text-xs text-[#6F675E]">
                  {d.updated_at ? new Date(d.updated_at).toLocaleString() : "—"}
                </div>
              </Link>
            );
          })}
        </div>
        {(!deals || deals.length === 0) && (
          <p className="px-4 py-12 text-center text-sm text-[#6F675E]">
            No deals yet. Inbound email creates deals via{" "}
            <code className="rounded bg-[#141414] px-1.5 py-0.5 text-[#C9A84C]">
              /api/webhooks/intake
            </code>
            .
          </p>
        )}
      </div>
    </div>
  );
}
