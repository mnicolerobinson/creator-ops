"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

type ClientOpt = { id: string; label: string };

export function DealsToolbar({ clients }: { clients: ClientOpt[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const params = new URLSearchParams();
    const stage = String(formData.get("stage") ?? "").trim();
    const client = String(formData.get("client") ?? "").trim();
    const from = String(formData.get("from") ?? "").trim();
    const to = String(formData.get("to") ?? "").trim();
    if (stage) params.set("stage", stage);
    if (client) params.set("client", client);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    startTransition(() => {
      router.push(`/ops/deals${params.toString() ? `?${params}` : ""}`);
    });
  }

  return (
    <form
      action={submit}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-4"
    >
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
        Stage
        <select
          name="stage"
          defaultValue={searchParams.get("stage") ?? ""}
          className="rounded-xl border border-[#2A211C] bg-[#050505] px-3 py-2 text-sm text-[#F7F0E8]"
        >
          <option value="">Any</option>
          {[
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
          ].map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </label>
      <label className="flex min-w-[200px] flex-col gap-1 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
        Client
        <select
          name="client"
          defaultValue={searchParams.get("client") ?? ""}
          className="rounded-xl border border-[#2A211C] bg-[#050505] px-3 py-2 text-sm text-[#F7F0E8]"
        >
          <option value="">Any</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
        Updated from
        <input
          type="date"
          name="from"
          defaultValue={searchParams.get("from") ?? ""}
          className="rounded-xl border border-[#2A211C] bg-[#050505] px-3 py-2 text-sm text-[#F7F0E8]"
        />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
        Updated to
        <input
          type="date"
          name="to"
          defaultValue={searchParams.get("to") ?? ""}
          className="rounded-xl border border-[#2A211C] bg-[#050505] px-3 py-2 text-sm text-[#F7F0E8]"
        />
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
