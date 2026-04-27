"use client";

import { useState, useTransition } from "react";
import { approveOutboundMessage } from "../actions";

export function ApproveMessageButton({ messageId }: { messageId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              await approveOutboundMessage(messageId);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not approve");
            }
          });
        }}
        className="rounded-full border border-[#143D24] bg-emerald-950/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-500/50 disabled:opacity-50"
      >
        {isPending ? "…" : "Approve & queue send"}
      </button>
      {error ? <p className="mt-1 text-xs text-[#C8102E]">{error}</p> : null}
    </div>
  );
}
