"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const authError = searchParams.get("error");
  const detail = searchParams.get("detail");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setStatus(error.message);
    } else {
      setStatus("Check your email for the magic link.");
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold tracking-tight">Creator Ops</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Sign in with your work email (magic link).
      </p>
      {authError ? (
        <div
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"
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
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-3">
        <label className="text-sm font-medium text-zinc-800">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-base"
            placeholder="you@company.com"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Send link
        </button>
      </form>
      {status ? (
        <p className="mt-4 text-sm text-zinc-700" role="status">
          {status}
        </p>
      ) : null}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
