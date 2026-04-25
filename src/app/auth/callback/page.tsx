"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");

      if (!code && !tokenHash) {
        router.replace("/login?error=auth");
        return;
      }

      const supabase = createClient();
      let error: Error | null = null;

      if (tokenHash) {
        const result = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: searchParams.get("type") as any,
        });
        error = result.error;
      } else if (code) {
        const result = await supabase.auth.exchangeCodeForSession(code);
        error = result.error;
      }

      if (error) {
        router.replace("/login?error=auth");
        return;
      }

      router.replace("/dashboard");
    };

    void run();
  }, [router, searchParams]);

  return (
    <div className="mx-auto flex min-h-[40vh] max-w-md flex-col justify-center px-6">
      <p className="text-center text-sm text-zinc-600">Signing you in…</p>
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
