"use client";

import { useEffect, useState } from "react";
import { StepNav } from "../_components";

function formatTier(tier: string | null | undefined) {
  if (tier === "starter_ops") return "Starter Ops — $500/month";
  if (tier === "growth_ops") return "Growth Ops — $1,250/month";
  if (tier === "creator_ceo") return "Creator CEO — $2,500/month";
  return null;
}

export function TierSummary({ initialTier }: { initialTier: string | null }) {
  const [tier, setTier] = useState<string | null>(initialTier);
  const tierName = formatTier(tier);
  const readyText = tierName
    ? `Your ${tierName} account is ready.`
    : "Your account is ready.";

  useEffect(() => {
    const storedTier = window.localStorage.getItem("creatrops:selected-tier");
    if (storedTier) {
      setTier(storedTier);
      return;
    }

    if (initialTier) {
      window.localStorage.setItem("creatrops:selected-tier", initialTier);
      setTier(initialTier);
    }
  }, [initialTier]);

  return (
    <>
      <p className="text-sm leading-8 text-[#B0A89A]">
        {readyText} We will walk you through the essentials so your ops team can
        begin handling brand partnership inquiries.
      </p>
      <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#141414] p-5">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[#B0A89A]">
          Selected tier
        </p>
        <p className="mt-3 font-[var(--font-cormorant)] text-3xl">
          {tierName ?? "Tier unavailable"}
        </p>
      </div>
      <StepNav step={1} />
    </>
  );
}
