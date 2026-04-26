import Link from "next/link";
import { requireOps } from "@/lib/auth/guards";

function stageClass(stage: string) {
  if (stage === "new") return "border-[#C8102E]/40 bg-[#C8102E]/15 text-[#FFCED6]";
  if (stage === "qualified") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (stage === "declined" || stage === "lost") return "border-zinc-500/30 bg-zinc-700/30 text-zinc-300";
  return "border-[#B0A89A]/30 bg-[#B0A89A]/10 text-[#F7F0E8]";
}

export default async function OpsHomePage() {
  const { supabase, profile, user } = await requireOps();
  let allowedClientIds: string[] | null = null;

  if (profile?.role !== "superadmin") {
    const { data: access } = await supabase
      .from("user_clients")
      .select("client_id")
      .eq("user_id", user.id);
    allowedClientIds = (access ?? []).map((row) => row.client_id);
  }

  let query = supabase
    .from("deals")
    .select(
      "id, title, stage, campaign_type, created_at, client_id, company_id, assigned_persona_id",
    )
    .order("created_at", { ascending: false });

  if (allowedClientIds) {
    if (allowedClientIds.length === 0) {
      query = query.in("client_id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      query = query.in("client_id", allowedClientIds);
    }
  }

  const { data: deals } = await query;
  const clientIds = Array.from(new Set((deals ?? []).map((deal) => deal.client_id)));
  const companyIds = Array.from(
    new Set((deals ?? []).map((deal) => deal.company_id).filter(Boolean)),
  );
  const personaIds = Array.from(
    new Set((deals ?? []).map((deal) => deal.assigned_persona_id).filter(Boolean)),
  );

  const [{ data: clients }, { data: companies }, { data: personas }] =
    await Promise.all([
      clientIds.length
        ? supabase.from("clients").select("id, name").in("id", clientIds)
        : Promise.resolve({ data: [] }),
      companyIds.length
        ? supabase.from("companies").select("id, name").in("id", companyIds)
        : Promise.resolve({ data: [] }),
      personaIds.length
        ? supabase.from("personas").select("id, display_name").in("id", personaIds)
        : Promise.resolve({ data: [] }),
    ]);

  const clientsById = new Map((clients ?? []).map((client) => [client.id, client.name]));
  const companiesById = new Map((companies ?? []).map((company) => [company.id, company.name]));
  const personasById = new Map(
    (personas ?? []).map((persona) => [persona.id, persona.display_name]),
  );

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-[#C8102E]">
          Sprint 1 CRM
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-[#F7F0E8]">
          Intake pipeline
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[#B0A89A]">
          Every inbound partnership email becomes a deal record with a message
          timeline, assigned persona, and next agent step.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#2A211C] bg-[#0B0B0B] shadow-2xl shadow-black/30">
        <div className="grid grid-cols-12 border-b border-[#2A211C] px-4 py-3 text-xs uppercase tracking-[0.18em] text-[#8F8678]">
          <div className="col-span-5">Brand</div>
          <div className="col-span-2">Campaign</div>
          <div className="col-span-2">Stage</div>
          <div className="col-span-2">Persona</div>
          <div className="col-span-1 text-right">Created</div>
        </div>
        <div className="divide-y divide-[#1D1713]">
          {(deals ?? []).map((deal) => {
            const brandName =
              (deal.company_id ? companiesById.get(deal.company_id) : null) ??
              deal.title;
            const persona =
              (deal.assigned_persona_id
                ? personasById.get(deal.assigned_persona_id)
                : null) ?? "Unassigned";
            return (
              <Link
                key={deal.id}
                href={`/ops/deals/${deal.id}`}
                className="grid grid-cols-12 items-center gap-3 px-4 py-4 text-sm transition hover:bg-[#14100D]"
              >
                <div className="col-span-5">
                  <p className="font-medium text-[#F7F0E8]">{brandName}</p>
                  <p className="mt-1 text-xs text-[#8F8678]">
                    {clientsById.get(deal.client_id)}
                  </p>
                </div>
                <div className="col-span-2 text-[#B0A89A]">
                  {deal.campaign_type ?? "Unknown"}
                </div>
                <div className="col-span-2">
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${stageClass(deal.stage)}`}>
                    {deal.stage}
                  </span>
                </div>
                <div className="col-span-2 text-[#B0A89A]">{persona}</div>
                <div className="col-span-1 text-right text-xs text-[#8F8678]">
                  {deal.created_at
                    ? new Date(deal.created_at).toLocaleDateString()
                    : "-"}
                </div>
              </Link>
            );
          })}
          {(!deals || deals.length === 0) && (
            <div className="px-4 py-12 text-center text-sm text-[#8F8678]">
              No inbound deals yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
