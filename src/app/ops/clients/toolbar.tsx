"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

export function ClientsToolbar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    const params = new URLSearchParams();
    const q = String(formData.get("q") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim();
    const tier = String(formData.get("tier") ?? "").trim();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (tier) params.set("tier", tier);
    startTransition(() => {
      router.push(`/ops/clients${params.toString() ? `?${params}` : ""}`);
    });
  }

  return (
    <form action={submit} className="flex flex-wrap items-end gap-3 rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-4">
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
        Search
        <input
          name="q"
          defaultValue={searchParams.get("q") ?? ""}
          placeholder="Name or handle"
          className="rounded-xl border border-[#2A211C] bg-[#050505] px-3 py-2 text-sm text-[#F7F0E8] outline-none focus:border-[#C8102E]/40"
        />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
        Status
        <select
          name="status"
          defaultValue={searchParams.get("status") ?? ""}
          className="rounded-xl border border-[#2A211C] bg-[#050505] px-3 py-2 text-sm text-[#F7F0E8]"
        >
          <option value="">Any</option>
          <option value="onboarding">Onboarding</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="churned">Churned</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
        Tier
        <select
          name="tier"
          defaultValue={searchParams.get("tier") ?? ""}
          className="rounded-xl border border-[#2A211C] bg-[#050505] px-3 py-2 text-sm text-[#F7F0E8]"
        >
          <option value="">Any</option>
          <option value="starter_ops">Starter Ops</option>
          <option value="growth_ops">Growth Ops</option>
          <option value="creator_ceo">Creator CEO</option>
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
