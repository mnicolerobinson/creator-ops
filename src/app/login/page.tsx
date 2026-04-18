"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

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
