import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Deal Ops agent — reminders, stage hygiene, follow-up tasks.
 */
export async function createDealTask(
  supabase: SupabaseClient,
  args: {
    dealId: string;
    title: string;
    dueAt?: string;
    payload?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await supabase.from("tasks").insert({
    deal_id: args.dealId,
    title: args.title,
    due_at: args.dueAt ?? null,
    payload_json: args.payload ?? {},
  });
  if (error) {
    throw error;
  }
  await supabase.from("agent_action_logs").insert({
    agent: "deal_ops",
    deal_id: args.dealId,
    trigger: "deal_ops.task",
    confidence: null,
    result_json: { title: args.title },
  });
}
