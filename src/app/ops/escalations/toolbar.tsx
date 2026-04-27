"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

const REASONS = [
  "low_confidence",
  "non_standard_contract_clause",
  "pricing_exception",
  "policy_violation",
  "brand_asked_if_bot",
  "threatening_language",
  "overdue_high_value",
  "tool_failure",
  "other",
] as const;

export function EscalationsToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const params = new URLSearchParams();
    const severity = String(formData.get("severity") ?? "").trim();
    const reason = String(formData.get("reason") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    if (severity) params.set("severity", severity);
    if (reason) params.set("reason", reason);
    if (status) params.set("status", status);
    startTransition(() => {
      router.push(`/ops/escalations${params.toString() ? `?${params}` : ""}`);
    });
  }

  return (
    <form
      action={submit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-4"
    >
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
        Severity
        <select
          name="severity"
          defaultValue={searchParams.get("severity") ?? ""}
          className="rounded-xl border border-[#2A211C] bg-[#050505] px-3 py-2 text-sm text-[#F7F0E8]"
        >
          <option value="">Any</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
        Reason
        <select
          name="reason"
          defaultValue={searchParams.get("reason") ?? ""}
          className="rounded-xl border border-[#2A211C] bg-[#050505] px-3 py-2 text-sm capitalize text-[#F7F0E8]"
        >
          <option value="">Any</option>
          {REASONS.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
        Status
        <select
          name="status"
          defaultValue={searchParams.get("status") ?? "open"}
          className="rounded-xl border border-[#2A211C] bg-[#050505] px-3 py-2 text-sm text-[#F7F0E8]"
        >
          <option value="open">Open queue</option>
          <option value="all">All</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-full bg-[#C8102E] px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-60"
      >
        Apply
      </button>
    </form>
  );
}
