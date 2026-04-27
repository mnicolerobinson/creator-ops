"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      setStatus(error.message);
      return;
    }
    window.location.href = "/dashboard";
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] px-6 py-10 text-[#FAFAFA]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(200,16,46,0.22),transparent_35%),radial-gradient(circle_at_80%_85%,rgba(201,168,76,0.18),transparent_35%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col justify-center">
        <p className="font-[var(--font-bebas)] text-3xl tracking-[0.18em]">
          <span>Creatr</span>
          <span className="text-[#C8102E]">Ops</span>
        </p>
        <p className="mt-2 text-[10px] uppercase tracking-[0.45em] text-[#C9A84C]">
          by Clairen Haus
        </p>
        <h1 className="mt-10 font-[var(--font-cormorant)] text-5xl font-light leading-none tracking-[-0.03em]">
          Your brand deals. Finally running themselves.
        </h1>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <label className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
            placeholder="you@company.com"
          />
        </label>
        <label className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
          Password
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-base text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
            placeholder="Your password"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-[#C8102E] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.25em] text-white transition hover:bg-[#8B0000]"
        >
          Sign In
        </button>
      </form>
      {status ? (
        <p className="mt-4 text-sm text-[#C9A84C]" role="status">
          {status}
        </p>
      ) : null}
      </div>
    </div>
  );
}
