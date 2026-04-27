import Link from "next/link";
import { requireOps } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EscalationDismiss } from "./dismiss";
import { EscalationResolve } from "./resolve";
import { EscalationsToolbar } from "./toolbar";

const SEVERITY_ORDER = ["critical", "high", "medium", "low"];

function severityRank(s: string | null | undefined) {
  const i = SEVERITY_ORDER.indexOf(String(s ?? "").toLowerCase());
  return i === -1 ? 99 : i;
}

export default async function EscalationsPage({
  searchParams,
}: {
  searchParams: Promise<{ severity?: string; reason?: string; status?: string }>;
}) {
  await requireOps();
  const sp = await searchParams;
  const supabase = await createServerSupabaseClient();

  const { data: cases } = await supabase
    .from("escalations")
    .select(
      "id, client_id, deal_id, reason, severity, status, summary, suggested_action, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(250);

  let rows = cases ?? [];

  const statusFilter = sp.status ?? "open";
  if (statusFilter === "open") {
    rows = rows.filter((c) => c.status === "open" || c.status === "in_review");
  } else if (statusFilter === "resolved") {
    rows = rows.filter((c) => c.status === "resolved");
  } else if (statusFilter === "dismissed") {
    rows = rows.filter((c) => c.status === "dismissed");
  }

  if (sp.severity) {
    rows = rows.filter((c) => String(c.severity).toLowerCase() === sp.severity!.toLowerCase());
  }
  if (sp.reason) {
    rows = rows.filter((c) => c.reason === sp.reason);
  }

  if (statusFilter === "open") {
    rows.sort(
      (a, b) =>
        severityRank(a.severity) - severityRank(b.severity) ||
        new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime(),
    );
  } else {
    rows.sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
    );
  }

  const clientIds = Array.from(new Set(rows.map((c) => c.client_id)));
  const { data: clientRows } = clientIds.length
    ? await supabase.from("clients").select("id, creator_display_name, name").in("id", clientIds)
    : { data: [] as { id: string; creator_display_name: string; name: string }[] };

  const clientMap = new Map((clientRows ?? []).map((c) => [c.id, c]));

  function severityClass(sev: string) {
    const s = String(sev).toLowerCase();
    if (s === "critical") return "border-[#C8102E] bg-[#C8102E]/20 text-[#FFCED6]";
    if (s === "high") return "border-orange-500/40 bg-orange-950/40 text-orange-200";
    if (s === "medium") return "border-[#C9A84C]/40 bg-[#C9A84C]/10 text-[#F7F0E8]";
    return "border-[#6F675E]/50 bg-[#141414] text-[#B0A89A]";
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#C8102E]">Exceptions</p>
        <h1 className="mt-3 font-[var(--font-cormorant)] text-4xl font-light text-[#F7F0E8]">
          Escalation queue
        </h1>
        <p className="mt-2 text-sm text-[#8F8678]">
          Open cases sort critical → low, then longest waiting first. Resolve or dismiss with notes.
        </p>
      </div>

      <EscalationsToolbar />

      <ul className="space-y-4">
        {rows.map((c) => {
          const client = clientMap.get(c.client_id);
          const clientLabel = client?.creator_display_name ?? client?.name ?? "Client";
          const openCase = c.status === "open" || c.status === "in_review";
          const openedMs = c.created_at ? new Date(c.created_at).getTime() : 0;
          const hoursOpen = openedMs ? Math.max(0, (Date.now() - openedMs) / 3600000) : 0;

          return (
            <li key={c.id} className="rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/ops/clients/${c.client_id}`}
                      className="font-medium text-[#C9A84C] hover:underline"
                    >
                      {clientLabel}
                    </Link>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${severityClass(c.severity)}`}
                    >
                      {c.severity}
                    </span>
                    <span className="rounded-full border border-[#2A211C] px-2 py-0.5 text-[10px] capitalize text-[#8F8678]">
                      {String(c.reason).replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-3 font-[var(--font-cormorant)] text-xl text-[#F7F0E8]">
                    {c.summary}
                  </p>
                  {c.suggested_action ? (
                    <p className="mt-2 text-sm leading-relaxed text-[#C9A84C]/90">
                      <span className="font-semibold text-[#C9A84C]">Suggested:</span>{" "}
                      {c.suggested_action}
                    </p>
                  ) : null}
                  <p className="mt-3 text-[10px] uppercase tracking-wider text-[#6F675E]">
                    {c.deal_id ? (
                      <Link className="text-[#C9A84C] hover:underline" href={`/ops/deals/${c.deal_id}`}>
                        Deal
                      </Link>
                    ) : (
                      "No deal"
                    )}
                    {" · "}
                    Status {c.status}
                    {" · "}
                    Open {hoursOpen >= 24 ? `${Math.floor(hoursOpen / 24)}d ` : ""}
                    {Math.round(hoursOpen % 24)}h
                    {" · "}
                    {c.created_at ? new Date(c.created_at).toLocaleString() : ""}
                  </p>
                </div>
                {openCase ? (
                  <div className="flex flex-col gap-4 sm:flex-row">
                    <EscalationResolve caseId={c.id} />
                    <EscalationDismiss caseId={c.id} />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
        {rows.length === 0 && (
          <li className="rounded-2xl border border-dashed border-[#2A211C] py-12 text-center text-sm text-[#6F675E]">
            No escalation cases match.
          </li>
        )}
      </ul>
    </div>
  );
}
