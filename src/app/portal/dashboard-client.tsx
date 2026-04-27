"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ActivityItem = {
  id: string;
  event_type: string;
  title: string;
  body: string | null;
  actor: string;
  created_at: string;
};

type CreatorMessage = {
  id: string;
  client_id: string;
  sender: "creator" | "operator";
  sender_user_id: string | null;
  body: string;
  read_at: string | null;
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

export function NotificationBellButton({
  clientId,
  initialUnreadCount,
}: {
  clientId: string;
  initialUnreadCount: number;
}) {
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`creator-message-bell-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "creator_messages",
          filter: `client_id=eq.${clientId}`,
        },
        async () => {
          const { count } = await supabase
            .from("creator_messages")
            .select("id", { count: "exact", head: true })
            .eq("client_id", clientId)
            .eq("sender", "operator")
            .is("read_at", null);
          setUnreadCount(count ?? 0);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId]);

  return (
    <button
      type="button"
      aria-label="Notifications"
      className="relative grid h-10 w-10 place-items-center rounded-full border border-[#2A211C] text-[#C9A84C]"
    >
      <Bell size={20} />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#C8102E] px-1 text-[10px] font-semibold text-white">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </button>
  );
}

export function CreatorMessagesPanel({
  clientId,
  accountManagerName,
}: {
  clientId: string;
  accountManagerName: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CreatorMessage[]>([]);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    async function loadMessages() {
      const response = await fetch(`/api/messages/creator/${clientId}`);
      const data = await response.json();
      setMessages(data.messages ?? []);
      await fetch(`/api/messages/creator/${clientId}/read`, { method: "POST" });
    }

    void loadMessages();
  }, [clientId, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`creator-messages-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "creator_messages",
          filter: `client_id=eq.${clientId}`,
        },
        (payload) => {
          setMessages((current) => [...current, payload.new as CreatorMessage]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [clientId, isOpen]);

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setIsSending(true);
    try {
      const response = await fetch(`/api/messages/creator/${clientId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Could not send message.");
      setMessages((current) => [...current, data.message]);
      setBody("");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="mt-5 w-full rounded-full bg-[#C8102E] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.25em] text-white transition hover:bg-[#8B0000]"
      >
        Message Sarah
      </button>
      {isOpen ? (
        <div className="fixed inset-0 z-50 bg-black/60">
          <aside className="ml-auto flex h-full w-full max-w-md flex-col border-l border-[#2A211C] bg-[#050505] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2A211C] p-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-[#C9A84C]">
                  Account manager
                </p>
                <h2 className="mt-1 font-[var(--font-cormorant)] text-3xl">
                  {accountManagerName}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-[#2A211C] p-2 text-[#B0A89A]"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-5">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`max-w-[85%] rounded-2xl p-4 text-sm ${
                    message.sender === "creator"
                      ? "ml-auto bg-[#C8102E] text-white"
                      : "bg-[#111111] text-[#F7F0E8] border border-[#2A211C]"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{message.body}</p>
                  <p className="mt-2 text-[10px] opacity-70">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
              {messages.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-[#2A211C] p-5 text-sm text-[#8F8678]">
                  No messages yet. Send Sarah a note when you need help.
                </p>
              ) : null}
            </div>
            <form onSubmit={sendMessage} className="border-t border-[#2A211C] p-4">
              <textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-4 text-sm text-[#F7F0E8] outline-none focus:border-[#C8102E]"
                placeholder="Write Sarah a message..."
              />
              <button
                disabled={isSending}
                className="mt-3 w-full rounded-full bg-[#C8102E] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.25em] text-white disabled:opacity-60"
              >
                {isSending ? "Sending..." : "Send"}
              </button>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}
