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
      const next = searchParams.get("next") ?? "/";

      if (!code) {
        setMessage("Missing sign-in code. Request a new link from the same browser you use to open it, or copy the link from email into this browser’s address bar.");
        router.replace("/login?error=missing_code");
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

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
