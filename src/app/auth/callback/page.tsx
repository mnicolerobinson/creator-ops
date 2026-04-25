"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Magic links use PKCE. The code verifier lives in this browser session.
 * Exchanging the code must run here (client), not in a Route Handler, or a
 * new tab / same browser often fails and sends you back to /login.
 */
function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Signing you in…");

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type") ?? "magiclink";
      const next = searchParams.get("next") ?? "/";
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (!code && !tokenHash && (!accessToken || !refreshToken)) {
        setMessage("Missing sign-in code. Request a new link from the same browser you use to open it, or copy the link from email into this browser’s address bar.");
        router.replace("/login?error=missing_code");
        return;
      }

      const supabase = createClient();
      let error: Error | null = null;

      if (tokenHash) {
        const result = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as
            | "signup"
            | "recovery"
            | "invite"
            | "magiclink"
            | "email_change"
            | "email",
        });
        error = result.error;
      } else if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        error = result.error;
      } else if (accessToken && refreshToken) {
        const result = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        error = result.error;
      }

      if (error) {
        setMessage(error.message);
        router.replace(
          `/login?error=auth&detail=${encodeURIComponent(error.message)}`,
        );
        return;
      }

      router.replace(next);
    };

    void run();
  }, [router, searchParams]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-md flex-col justify-center px-6">
      <p className="text-center text-sm text-zinc-600">{message}</p>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <p className="p-8 text-center text-sm text-zinc-600">Loading…</p>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
