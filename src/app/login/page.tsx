"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"magic_link" | "password">("magic_link");
  const [status, setStatus] = useState<string | null>(null);

  const authError = searchParams.get("error");
  const detail = searchParams.get("detail");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const supabase = createClient();

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setStatus(error.message);
        return;
      }
      window.location.href = "/dashboard";
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_SITE_URL + "/auth/callback",
        },
      });
    if (error) {
      setStatus(error.message);
    } else {
      setStatus("Check your email for a sign-in link");
    }
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
        <p className="mt-5 text-sm leading-8 text-[#B0A89A]">
          Sign in with your work email. Magic link stays primary, and password
          sign-in is available as a fallback when you need it.
        </p>
      {authError ? (
        <div
          className="mt-6 rounded-2xl border border-[#C8102E]/40 bg-[#141414] px-4 py-3 text-sm text-[#FAFAFA]"
          role="alert"
        >
          <p className="font-medium">Sign-in did not complete</p>
          {detail ? (
            <p className="mt-1 text-xs opacity-90">{decodeURIComponent(detail)}</p>
          ) : null}
          <p className="mt-2 text-xs">
            Open the magic link in the <strong>same browser</strong> you used to
            request it (or copy the link from your email and paste it into that
            browser’s address bar). In-app mail browsers often break this flow.
          </p>
        </div>
      ) : null}
      <div className="mt-8 grid grid-cols-2 rounded-full border border-white/10 bg-[#101010] p-1">
        <button
          type="button"
          onClick={() => {
            setMode("magic_link");
            setStatus(null);
          }}
          className={`rounded-full px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition ${
            mode === "magic_link"
              ? "bg-[#C8102E] text-white"
              : "text-[#B0A89A] hover:text-[#FAFAFA]"
          }`}
        >
          Send magic link
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("password");
            setStatus(null);
          }}
          className={`rounded-full px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] transition ${
            mode === "password"
              ? "bg-[#C8102E] text-white"
              : "text-[#B0A89A] hover:text-[#FAFAFA]"
          }`}
        >
          Sign in with password
        </button>
      </div>

      <form onSubmit={onSubmit} className="mt-5 flex flex-col gap-4">
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
        {mode === "password" ? (
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
        ) : null}
        <button
          type="submit"
          className="rounded-full bg-[#C8102E] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.25em] text-white transition hover:bg-[#8B0000]"
        >
          {mode === "password" ? "Sign in" : "Send magic link"}
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

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="bg-[#050505] p-8 text-center text-sm text-[#FAFAFA]">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}
