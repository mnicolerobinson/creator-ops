"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ClientRow = {
  id: string;
  name: string;
  creator_display_name: string;
  status: string;
  onboarding_completed_at?: string | null;
};

export function OpsSignupToasts() {
  const [toasts, setToasts] = useState<(ClientRow & { key: string })[]>([]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("ops-clients-onboarding")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "clients",
        },
        (payload) => {
          const row = payload.new as ClientRow;
          const prev = payload.old as Partial<ClientRow> | undefined;
          const completedNow =
            !!row.onboarding_completed_at &&
            (!prev?.onboarding_completed_at ||
              prev.onboarding_completed_at !== row.onboarding_completed_at);
          if (!completedNow) return;
          const key = `${row.id}-${Date.now()}`;
          setToasts((t) => [...t, { ...row, key }]);
          window.setTimeout(() => {
            setToasts((t) => t.filter((x) => x.key !== key));
          }, 12000);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex max-w-sm flex-col gap-3">
      {toasts.map((t) => (
        <div
          key={t.key}
          className="pointer-events-auto rounded-2xl border border-[#C9A84C]/35 bg-[#0B0B0B]/95 px-4 py-3 shadow-2xl shadow-black/50 backdrop-blur-sm"
        >
          <p className="text-[10px] uppercase tracking-[0.28em] text-[#C9A84C]">
            Onboarding complete
          </p>
          <p className="mt-1 font-[var(--font-cormorant)] text-lg text-[#F7F0E8]">
            {t.creator_display_name || t.name}
          </p>
          <p className="mt-0.5 text-xs text-[#8F8678]">{t.status}</p>
        </div>
      ))}
    </div>
  );
}
