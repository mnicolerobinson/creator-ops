"use client";

import { useState } from "react";

export function ResendMagicLink() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSending(true);
    setStatus(null);

    try {
      const response = await fetch("/api/auth/resend-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "Could not send sign-in link.");
      }
      setStatus("Sign-in link sent. Check your email.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not send sign-in link.");
    } finally {
      setIsSending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-white/10 bg-[#141414] p-5">
      <label className="block text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="mt-2 w-full rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-base normal-case tracking-normal text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
          placeholder="you@example.com"
        />
      </label>
      <button
        type="submit"
        disabled={isSending}
        className="w-full rounded-full bg-[#C8102E] px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-white transition hover:bg-[#8B0000] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSending ? "Sending..." : "Resend magic link"}
      </button>
      {status ? <p className="text-sm text-[#C9A84C]">{status}</p> : null}
    </form>
  );
}
