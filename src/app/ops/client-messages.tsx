"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type CreatorMessage = {
  id: string;
  client_id: string;
  sender: "creator" | "operator";
  sender_user_id: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
};

export function OpsClientMessages({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const [messages, setMessages] = useState<CreatorMessage[]>([]);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    async function load() {
      const response = await fetch(`/api/messages/creator/${clientId}`);
      const data = await response.json();
      setMessages(data.messages ?? []);
      await fetch(`/api/messages/creator/${clientId}/read`, { method: "POST" });
    }
    void load();
  }, [clientId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`ops-client-messages-${clientId}`)
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
  }, [clientId]);

  async function sendReply(event: React.FormEvent) {
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
      if (!response.ok) throw new Error(data.error ?? "Could not send reply.");
      setMessages((current) => [...current, data.message]);
      setBody("");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <section className="space-y-4 rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.35em] text-[#C8102E]">Messages</p>
        <h2 className="mt-2 font-serif text-2xl font-semibold text-[#F7F0E8]">
          {clientName}
        </h2>
      </div>
      <div className="max-h-96 space-y-3 overflow-y-auto rounded-2xl border border-[#2A211C] bg-[#050505] p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`max-w-[85%] rounded-2xl p-4 text-sm ${
              message.sender === "operator"
                ? "ml-auto bg-[#C8102E] text-white"
                : "border border-[#2A211C] bg-[#111111] text-[#F7F0E8]"
            }`}
          >
            <p className="whitespace-pre-wrap">{message.body}</p>
            <p className="mt-2 text-[10px] opacity-70">
              {new Date(message.created_at).toLocaleString()}
            </p>
          </div>
        ))}
        {messages.length === 0 ? (
          <p className="text-sm text-[#8F8678]">No creator messages yet.</p>
        ) : null}
      </div>
      <form onSubmit={sendReply} className="space-y-3">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={3}
          className="w-full rounded-2xl border border-[#2A211C] bg-[#050505] p-4 text-sm text-[#F7F0E8] outline-none focus:border-[#C8102E]"
          placeholder="Reply as Sarah..."
        />
        <button
          disabled={isSending}
          className="rounded-full bg-[#C8102E] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.25em] text-white disabled:opacity-60"
        >
          {isSending ? "Sending..." : "Send reply"}
        </button>
      </form>
    </section>
  );
}
