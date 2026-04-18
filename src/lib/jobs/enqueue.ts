import type { SupabaseClient } from "@supabase/supabase-js";

export async function enqueueJob(
  supabase: SupabaseClient,
  args: {
    jobType: string;
    payload: Record<string, unknown>;
    runAfter?: string;
    idempotencyKey?: string;
  },
): Promise<void> {
  const { error } = await supabase.from("job_queue").insert({
    job_type: args.jobType,
    payload_json: args.payload,
    run_after: args.runAfter ?? new Date().toISOString(),
    idempotency_key: args.idempotencyKey ?? null,
    status: "pending",
  });

  if (error) {
    if (error.code === "23505" && args.idempotencyKey) {
      return;
    }
    throw error;
  }
}
