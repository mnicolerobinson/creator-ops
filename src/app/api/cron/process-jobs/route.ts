import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { processJobQueue } from "@/lib/jobs/process";

export async function GET(request: Request) {
  const env = getEnv();
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const auth = request.headers.get("authorization");

  const ok =
    (env.CRON_SECRET && secret === env.CRON_SECRET) ||
    (env.CRON_SECRET && auth === `Bearer ${env.CRON_SECRET}`);

  if (!env.CRON_SECRET || !ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  /* Vercel Cron: set CRON_SECRET in project env; Vercel sends Authorization: Bearer <CRON_SECRET>. */

  const supabase = createAdminClient();
  const result = await processJobQueue(supabase);
  return NextResponse.json(result);
}
