"use client";

import { useTransition } from "react";
import {
  approveDocument,
  createContractDraft,
  createStripeInvoice,
} from "@/app/ops/actions";

export function DealActions({ dealId }: { dealId: string }) {
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-wrap gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <button
        type="button"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
        onClick={() =>
          start(async () => {
            await createContractDraft(dealId, "template_default");
          })
        }
      >
        Draft contract (Documenso job)
      </button>
      <button
        type="button"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50 disabled:opacity-50"
        onClick={() =>
          start(async () => {
            await createStripeInvoice(dealId, 2500_00);
          })
        }
      >
        Create invoice ($2,500)
      </button>
      <p className="w-full text-xs text-zinc-500">
        v1: contract draft and invoice enqueue background jobs. Approve documents
        from the list below when status is pending approval.
      </p>
    </div>
  );
}

export function ApproveButton({ documentId }: { documentId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-sm font-medium text-zinc-900 underline"
      onClick={() =>
        start(async () => {
          await approveDocument(documentId);
        })
      }
    >
      Approve
    </button>
  );
}
