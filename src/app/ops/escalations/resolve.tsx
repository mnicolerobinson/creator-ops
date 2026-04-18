"use client";

import { useState, useTransition } from "react";
import { resolveEscalation } from "@/app/ops/actions";

export function EscalationResolve({ caseId }: { caseId: string }) {
  const [notes, setNotes] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="flex min-w-[200px] flex-col gap-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Resolution notes"
        className="rounded-md border border-zinc-300 px-2 py-1 text-sm"
        rows={2}
      />
      <button
        type="button"
        disabled={pending || !notes.trim()}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
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
