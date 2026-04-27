"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  approveOutboundMessage,
  rejectOutboundMessage,
  updateOutboundDraft,
} from "../actions";

export function ApprovalActions({
  messageId,
  dealId,
  initialSubject,
  initialBody,
}: {
  messageId: string;
  dealId: string | null;
  initialSubject: string;
  initialBody: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refresh() {
    router.refresh();
    setEditing(false);
    setShowReject(false);
    setRejectReason("");
  }

  return (
    <div className="flex w-full max-w-md shrink-0 flex-col gap-3 md:items-end">
      {dealId ? (
        <Link
          href={`/ops/deals/${dealId}`}
          className="text-[10px] uppercase tracking-[0.2em] text-[#C9A84C] hover:underline"
        >
          Open deal →
        </Link>
      ) : null}

      {editing ? (
        <div className="w-full space-y-2 rounded-xl border border-[#2A211C] bg-[#050505] p-3">
          <label className="block text-[10px] uppercase tracking-[0.18em] text-[#6F675E]">
            Subject
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[#2A211C] bg-[#0B0B0B] px-2 py-1.5 text-sm text-[#F7F0E8]"
            />
          </label>
          <label className="block text-[10px] uppercase tracking-[0.18em] text-[#6F675E]">
            Body
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="mt-1 w-full rounded-lg border border-[#2A211C] bg-[#0B0B0B] px-2 py-1.5 text-sm text-[#F7F0E8]"
            />
          </label>
          <button
            type="button"
            disabled={pending}
            className="rounded-full bg-[#2A211C] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#F7F0E8]"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await updateOutboundDraft(messageId, subject, body);
                  router.refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not save");
                }
              });
            }}
          >
            Save draft
          </button>
        </div>
      ) : null}

      {showReject ? (
        <textarea
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
          placeholder="Reason for rejection (required)"
          rows={3}
          className="w-full rounded-xl border border-[#C8102E]/40 bg-[#050505] px-3 py-2 text-sm text-[#F7F0E8]"
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!editing ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-full border border-[#143D24] bg-emerald-950/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200 transition hover:border-emerald-500/50 disabled:opacity-50"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await approveOutboundMessage(messageId);
                  refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not approve");
                }
              });
            }}
          >
            Approve & send
          </button>
        ) : null}
        {!editing ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-full border border-[#C9A84C]/40 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#C9A84C]"
            onClick={() => setEditing(true)}
          >
            Edit
          </button>
        ) : (
          <button
            type="button"
            className="rounded-full border border-[#6F675E]/50 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-[#B0A89A]"
            onClick={() => setEditing(false)}
          >
            Cancel edit
          </button>
        )}
        {!showReject ? (
          <button
            type="button"
            disabled={pending}
            className="rounded-full border border-[#C8102E]/50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#FFCED6]"
            onClick={() => setShowReject(true)}
          >
            Reject
          </button>
        ) : (
          <button
            type="button"
            disabled={pending || !rejectReason.trim()}
            className="rounded-full bg-[#C8102E] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-50"
            onClick={() => {
              setError(null);
              startTransition(async () => {
                try {
                  await rejectOutboundMessage(messageId, rejectReason.trim());
                  refresh();
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not reject");
                }
              });
            }}
          >
            Confirm reject
          </button>
        )}
      </div>
      {error ? <p className="text-xs text-[#C8102E]">{error}</p> : null}
    </div>
  );
}
