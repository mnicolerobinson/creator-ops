"use client";

import { useTransition } from "react";
import { transitionDealStage } from "../actions";

const STAGES = [
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
  "paid",
  "completed",
  "declined",
  "lost",
] as const;

export function DealStageControl({
  dealId,
  stage,
}: {
  dealId: string;
  stage: string;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <select
      aria-label="Move deal stage"
      disabled={pending}
      value={stage}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await transitionDealStage(dealId, next);
        });
      }}
      className="max-w-[11rem] rounded-lg border border-[#2A211C] bg-[#050505] px-2 py-1 text-[11px] capitalize text-[#F7F0E8] outline-none focus:border-[#C8102E]/50"
      onClick={(ev) => ev.stopPropagation()}
    >
      {STAGES.map((s) => (
        <option key={s} value={s}>
          {s.replace(/_/g, " ")}
        </option>
      ))}
    </select>
  );
}
