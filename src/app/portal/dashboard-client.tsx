"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ActivityItem = {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  actor: string;
  created_at: string;
};

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
      className="rounded-full border border-[#C8102E]/50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#F7F0E8] transition hover:bg-[#C8102E]"
    >
      Sign out
    </button>
  );
}

export function CopyReferralButton({ referralLink }: { referralLink: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(referralLink);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }}
      className="rounded-full bg-[#C8102E] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-[#A50D25]"
    >
      {copied ? "Copied" : "Copy link"}
    </button>
  );
}

export function LiveActivityFeed({
  clientId,
  initialItems,
}: {
  clientId: string;
  initialItems: ActivityItem[];
}) {
  const [items, setItems] = useState(initialItems);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`activity-feed-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_feed",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          const next = payload.new as ActivityItem;
          setItems((current) => [next, ...current].slice(0, 20));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId]);

  const rendered = useMemo(() => items.slice(0, 20), [items]);

  return (
    <div className="space-y-3">
      {rendered.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-[#2A211C] bg-[#0C0C0C] p-4"
        >
          <div className="flex items-start gap-3">
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-[#C9A84C] shadow-[0_0_18px_rgba(201,168,76,0.8)]" />
            <div>
              <p className="text-sm font-medium text-[#F7F0E8]">{item.title}</p>
              {item.body ? (
                <p className="mt-1 text-sm text-[#B0A89A]">{item.body}</p>
              ) : null}
              <p className="mt-2 text-xs uppercase tracking-[0.16em] text-[#6F675E]">
                {item.actor} · {new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ))}
      {rendered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#2A211C] p-6 text-sm text-[#8F8678]">
          No activity yet. New deal updates will appear here live.
        </div>
      ) : null}
    </div>
  );
}
