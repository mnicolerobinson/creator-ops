import Link from "next/link";
import { requireOps } from "@/lib/auth/guards";
import { getOpsAllowedClientIds } from "@/lib/ops/client-access";
import { ApproveMessageButton } from "./approve-button";

export default async function OpsMessageApprovalPage() {
  const { supabase, profile, user } = await requireOps();
  const allowed = await getOpsAllowedClientIds(supabase, user.id, profile?.role);

  let q = supabase
    .from("messages")
    .select(
      "id, client_id, deal_id, subject, body_text, status, created_at, requires_review, direction, from_address, drafted_by_agent, draft_confidence",
    )
    .eq("requires_review", true)
    .order("created_at", { ascending: false })
    .limit(100);

  if (allowed) {
    if (allowed.length === 0) {
      q = q.in("client_id", ["00000000-0000-0000-0000-000000000000"] as string[]);
    } else {
      q = q.in("client_id", allowed);
    }
  }

  const { data: messages } = await q;
  const cids = Array.from(new Set((messages ?? []).map((m) => m.client_id)));
  const { data: cl } = cids.length
    ? await supabase.from("clients").select("id, name, creator_display_name").in("id", cids)
    : { data: [] as { id: string; name: string; creator_display_name: string }[] };

  const cMap = new Map((cl ?? []).map((c) => [c.id, c]));

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#C8102E]">Human-in-the-loop</p>
        <h1 className="mt-3 font-[var(--font-cormorant)] text-4xl font-light text-[#F7F0E8]">
          Message approval
        </h1>
        <p className="mt-2 text-sm text-[#8F8678]">
          Outbound email drafts that require review before they are queued to send. Approve to
          release; open the deal for full context.
        </p>
      </div>

      <ul className="space-y-4">
        {(messages ?? []).map((m) => {
          const client = cMap.get(m.client_id);
          return (
            <li
              key={m.id}
              className="rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#C9A84C]">
                    {client?.creator_display_name ?? client?.name ?? "Client"}
                  </p>
                  <h2 className="mt-1 font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">
                    {m.subject?.trim() || "(No subject)"}
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#B0A89A]">
                    {m.body_text ?? "—"}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3 text-[10px] uppercase tracking-wider text-[#6F675E]">
                    <span>Status: {m.status}</span>
                    {m.drafted_by_agent ? <span>Agent: {m.drafted_by_agent}</span> : null}
                    {m.draft_confidence != null ? (
                      <span>Confidence: {Number(m.draft_confidence).toFixed(2)}</span>
                    ) : null}
                    {m.from_address ? <span>From: {m.from_address}</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col gap-2 md:items-end">
                  {m.deal_id ? (
                    <Link
                      href={`/ops/deals/${m.deal_id}`}
                      className="text-[10px] uppercase tracking-[0.2em] text-[#C9A84C] hover:underline"
                    >
                      Open deal →
                    </Link>
                  ) : null}
                  <ApproveMessageButton messageId={m.id} />
                </div>
              </div>
            </li>
          );
        })}
        {(!messages || messages.length === 0) && (
          <li className="rounded-2xl border border-dashed border-[#2A211C] py-12 text-center text-sm text-[#6F675E]">
            Nothing in the approval queue.
          </li>
        )}
      </ul>

      <p className="text-center text-xs text-[#5c544a]">
        <Link href="/ops" className="text-[#C9A84C] hover:underline">
          ← Ops home
        </Link>
      </p>
    </div>
  );
}
