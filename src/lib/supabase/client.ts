import { createBrowserClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

export function createClient() {
  const env = getEnv();
  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        /**
         * Local magic-link flow is unreliable with PKCE when email links are opened
         * through different browser contexts. Use implicit to avoid PKCE verifier
         * storage dependency during development.
         */
        flowType: "implicit",
      },
    },
  );
}
