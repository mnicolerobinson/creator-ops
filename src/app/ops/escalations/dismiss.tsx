"use client";

import { useState, useTransition } from "react";
import { dismissEscalation } from "../actions";

export function EscalationDismiss({ caseId }: { caseId: string }) {
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex min-w-[200px] flex-col gap-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Dismissal notes (required)"
        className="rounded-xl border border-[#2A211C] bg-[#050505] px-3 py-2 text-sm text-[#F7F0E8] outline-none focus:border-[#C8102E]/50"
        rows={3}
      />
      <button
        type="button"
        disabled={pending || !notes.trim()}
        className="rounded-full border border-[#6F675E]/60 bg-transparent px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#B0A89A] transition hover:border-[#C8102E]/60 hover:text-[#F7F0E8] disabled:opacity-50"
        onClick={() =>
          start(async () => {
            await dismissEscalation(caseId, notes.trim());
            setNotes("");
          })
        }
      >
        Dismiss
      </button>
    </div>
  );
}
