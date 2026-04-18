import type { SupabaseClient } from "@supabase/supabase-js";
import { enqueueJob } from "@/lib/jobs/enqueue";

/**
 * Renewal agent — schedules re-engagement via job queue.
 */
export async function scheduleRenewalPing(
  supabase: SupabaseClient,
  dealId: string,
  runAfter?: string,
): Promise<void> {
  await enqueueJob(supabase, {
    jobType: "renewal_ping",
    payload: { deal_id: dealId },
    runAfter:
      runAfter ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    idempotencyKey: `renewal-${dealId}-${runAfter ?? "default"}`,
  });
}
