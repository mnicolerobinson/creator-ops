import Link from "next/link";
import { requireOps } from "@/lib/auth/guards";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EscalationResolve } from "./resolve";

export default async function EscalationsPage() {
  await requireOps();
  const supabase = await createServerSupabaseClient();

  const { data: cases } = await supabase
    .from("escalations")
    .select("id, deal_id, reason, severity, status, summary, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  const open = (cases ?? []).filter((c) => c.status === "open" || c.status === "in_review");

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#C8102E]">Exceptions</p>
        <h1 className="mt-3 font-[var(--font-cormorant)] text-4xl font-light text-[#F7F0E8]">
          Escalation queue
        </h1>
        <p className="mt-2 text-sm text-[#8F8678]">
          {open.length} open · Persona, legal, low-confidence, and policy routing.
        </p>
      </div>

      <ul className="space-y-4">
        {(cases ?? []).map((c) => (
          <li
            key={c.id}
            className="rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">
                  {c.reason}
                  <span className="ml-2 text-sm font-sans text-[#C9A84C]">
                    · severity {c.severity}
                  </span>
                </p>
                <p className="mt-2 text-sm leading-relaxed text-[#B0A89A]">{c.summary}</p>
                <p className="mt-3 text-[10px] uppercase tracking-wider text-[#6F675E]">
                  {c.deal_id ? (
                    <Link
                      className="text-[#C9A84C] hover:underline"
                      href={`/ops/deals/${c.deal_id}`}
                    >
                      Deal
                    </Link>
                  ) : (
                    "No deal"
                  )}
                  {" · "}
                  {c.status}
                  {" · "}
                  {c.created_at ? new Date(c.created_at).toLocaleString() : ""}
                </p>
              </div>
              {c.status === "open" || c.status === "in_review" ? (
                <EscalationResolve caseId={c.id} />
              ) : null}
            </div>
          </li>
        ))}
        {(!cases || cases.length === 0) && (
          <li className="rounded-2xl border border-dashed border-[#2A211C] py-12 text-center text-sm text-[#6F675E]">
            No escalation cases.
          </li>
        )}
      </ul>
    </div>
  );
}
