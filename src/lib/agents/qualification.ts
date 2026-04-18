import type { SupabaseClient } from "@supabase/supabase-js";
import { QUAL_AUTO, QUAL_INFO } from "@/lib/agents/thresholds";

export type QualificationInput = {
  dealId: string;
  /** 0–1 heuristic or model score */
  rawScore: number;
  budgetCents?: number | null;
  policyMinCents?: number | null;
};

/**
 * Maps raw score + policy checks to PRD qualification_status and fit_score.
 */
export function scoreToQualification(
  input: QualificationInput,
): {
  fit_score: number;
  qualification_status: "qualified" | "needs_info" | "declined" | "escalated";
} {
  let score = input.rawScore;
  if (
    input.policyMinCents != null &&
    input.budgetCents != null &&
    input.budgetCents < input.policyMinCents
  ) {
    score = Math.min(score, QUAL_INFO - 0.01);
  }

  if (score >= QUAL_AUTO) {
    return { fit_score: score, qualification_status: "qualified" };
  }
  if (score >= QUAL_INFO) {
    return { fit_score: score, qualification_status: "needs_info" };
  }
  return { fit_score: score, qualification_status: "declined" };
}

export async function applyQualification(
  supabase: SupabaseClient,
  input: QualificationInput,
): Promise<{ fit_score: number; qualification_status: string }> {
  const result = scoreToQualification(input);
  const { error } = await supabase
    .from("deals")
    .update({
      fit_score: result.fit_score,
      qualification_status: result.qualification_status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.dealId);

  if (error) {
    throw error;
  }

  await supabase.from("agent_action_logs").insert({
    agent: "qualification",
    deal_id: input.dealId,
    trigger: "qualification.apply",
    confidence: result.fit_score,
    result_json: result,
  });

  return result;
}
