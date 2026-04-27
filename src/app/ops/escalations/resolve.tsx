"use client";

import { useState, useTransition } from "react";
import { resolveEscalation } from "@/app/ops/actions";

export function EscalationResolve({ caseId }: { caseId: string }) {
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex min-w-[220px] flex-col gap-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Resolution notes"
        className="rounded-xl border border-[#2A211C] bg-[#050505] px-3 py-2 text-sm text-[#F7F0E8] outline-none focus:border-[#C8102E]/50"
        rows={3}
      />
      <button
        type="button"
        disabled={pending || !notes.trim()}
        className="rounded-full bg-[#C8102E] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[#8B0000] disabled:opacity-50"
        onClick={() =>
          start(async () => {
            await resolveEscalation(caseId, notes.trim());
            setNotes("");
          })
        }
      >
        Resolve
      </button>
    </div>
  );
}
