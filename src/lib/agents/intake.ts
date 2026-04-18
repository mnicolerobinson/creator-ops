import type { SupabaseClient } from "@supabase/supabase-js";

export type IntakePayload = {
  creatorId: string;
  contact: {
    email?: string | null;
    name?: string | null;
    company?: string | null;
    source?: string | null;
  };
  deal: {
    title: string;
    campaign_type?: string | null;
    platform?: string | null;
    budget_cents?: number | null;
    rights_summary?: string | null;
  };
};

export async function runIntake(
  supabase: SupabaseClient,
  payload: IntakePayload,
): Promise<{ contactId: string; dealId: string }> {
  const { data: contact, error: cErr } = await supabase
    .from("contacts")
    .insert({
      creator_id: payload.creatorId,
      email: payload.contact.email,
      name: payload.contact.name,
      company: payload.contact.company,
      source: payload.contact.source ?? "form",
    })
    .select("id")
    .single();

  if (cErr || !contact) {
    throw cErr ?? new Error("contact insert failed");
  }

  const { data: persona } = await supabase
    .from("personas")
    .select("id")
    .eq("creator_id", payload.creatorId)
    .limit(1)
    .maybeSingle();

  const { data: deal, error: dErr } = await supabase
    .from("deals")
    .insert({
      creator_id: payload.creatorId,
      contact_id: contact.id,
      persona_id: persona?.id ?? null,
      title: payload.deal.title,
      campaign_type: payload.deal.campaign_type,
      platform: payload.deal.platform,
      budget_cents: payload.deal.budget_cents,
      rights_summary: payload.deal.rights_summary,
      stage: "lead",
      qualification_status: "pending",
    })
    .select("id")
    .single();

  if (dErr || !deal) {
    throw dErr ?? new Error("deal insert failed");
  }

  await supabase.from("agent_action_logs").insert({
    agent: "intake",
    deal_id: deal.id,
    trigger: "intake.create",
    confidence: null,
    result_json: { contact_id: contact.id },
  });

  return { contactId: contact.id, dealId: deal.id };
}
