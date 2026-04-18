/**
 * Process pending jobs once. Run on a schedule (e.g. cron) or loop in production.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/worker.ts
 */

import { createClient } from "@supabase/supabase-js";
import { processJobQueue } from "../src/lib/jobs/process";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const result = await processJobQueue(supabase);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
