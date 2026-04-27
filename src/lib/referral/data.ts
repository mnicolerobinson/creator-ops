import { createAdminClient } from "@/lib/supabase/admin";

export type ReferralTableRow = {
  userId: string;
  displayName: string;
  planTier: string;
  isActive: boolean;
  dateJoined: string;
  monthlyCommissionCents: number;
  referredByDisplayName?: string;
};

function formatTierKey(raw: string | null | undefined): string {
  if (!raw) return "—";
  const map: Record<string, string> = {
    starter_ops: "Starter Ops",
    growth_ops: "Growth Ops",
    creator_ceo: "Creator CEO",
  };
  if (map[raw]) return map[raw];
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function creatorDisplayNameForUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string> {
  const { data: row } = await admin
    .from("user_clients")
    .select("clients(creator_display_name, name)")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  const clients = row?.clients;
  const c = Array.isArray(clients) ? clients[0] : clients;
  if (c && typeof c === "object") {
    const o = c as { creator_display_name?: string | null; name?: string | null };
    if (o.creator_display_name?.trim()) return o.creator_display_name.trim();
    if (o.name?.trim()) return o.name.trim();
  }
  const { data: prof } = await admin
    .from("user_profiles")
    .select("full_name")
    .eq("id", userId)
    .maybeSingle();
  if (prof?.full_name?.trim()) return prof.full_name.trim();
  return "Creator";
}

async function getClientIdForUser(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<string | null> {
  const { data } = await admin
    .from("user_clients")
    .select("client_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  return data?.client_id ?? null;
}

async function buildRow(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  commByClient: Map<string, number>,
  referredByDisplayName?: string,
): Promise<ReferralTableRow> {
  const { data: up } = await admin
    .from("user_profiles")
    .select("created_at")
    .eq("id", userId)
    .single();

  const clientId = await getClientIdForUser(admin, userId);
  let planTier = "—";
  let isActive = false;
  if (clientId) {
    const { data: cl } = await admin
      .from("clients")
      .select("subscription_tier, subscription_status")
      .eq("id", clientId)
      .maybeSingle();
    planTier = formatTierKey(cl?.subscription_tier);
    isActive = (cl?.subscription_status ?? "") === "active";
  }

  const monthlyCommissionCents = clientId ? commByClient.get(clientId) ?? 0 : 0;
  return {
    userId,
    displayName: await creatorDisplayNameForUser(admin, userId),
    planTier,
    isActive,
    dateJoined: up?.created_at ?? new Date().toISOString(),
    monthlyCommissionCents,
    referredByDisplayName,
  };
}

/**
 * Referred user lists for the portal referral dashboard. Service role only.
 */
export async function getReferralDashboardData(affiliateUserId: string) {
  const admin = createAdminClient();
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const { data: me } = await admin
    .from("user_profiles")
    .select("id, affiliate_tier, referral_code")
    .eq("id", affiliateUserId)
    .single();

  if (!me) {
    throw new Error("Profile not found.");
  }

  const { data: commRows } = await admin
    .from("affiliate_commissions")
    .select("referred_client_id, commission_cents")
    .eq("affiliate_user_id", affiliateUserId)
    .eq("month_year", monthKey);

  const commByClient = new Map<string, number>();
  for (const r of commRows ?? []) {
    if (!r.referred_client_id) continue;
    const prev = commByClient.get(r.referred_client_id) ?? 0;
    const add = Number(r.commission_cents) || 0;
    commByClient.set(r.referred_client_id, prev + add);
  }

  const { data: directProfiles } = await admin
    .from("user_profiles")
    .select("id")
    .eq("referred_by_user_id", affiliateUserId)
    .order("created_at", { ascending: false });

  const directIds = (directProfiles ?? []).map((d) => d.id);

  const directRows: ReferralTableRow[] = [];
  for (const id of directIds) {
    directRows.push(await buildRow(admin, id, commByClient, undefined));
  }

  const tier1MonthlyCents = directRows.reduce((s, r) => s + r.monthlyCommissionCents, 0);

  let tier2Rows: ReferralTableRow[] = [];
  if (me.affiliate_tier === "founding" && directIds.length > 0) {
    const { data: secondTier } = await admin
      .from("user_profiles")
      .select("id, referred_by_user_id, created_at")
      .in("referred_by_user_id", directIds)
      .order("created_at", { ascending: false });

    for (const st of secondTier ?? []) {
      const refBy = st.referred_by_user_id;
      const byName = refBy ? await creatorDisplayNameForUser(admin, refBy) : "—";
      tier2Rows.push(await buildRow(admin, st.id, commByClient, byName));
    }
  }

  const tier2MonthlyCents = tier2Rows.reduce((s, r) => s + r.monthlyCommissionCents, 0);
  const totalMonthlyCents = tier1MonthlyCents + tier2MonthlyCents;
  const activeCount = [...directRows, ...tier2Rows].filter((r) => r.isActive).length;
  const allReferredCount =
    me.affiliate_tier === "founding"
      ? directRows.length + tier2Rows.length
      : directRows.length;

  return {
    code: (me.referral_code ?? affiliateUserId.slice(0, 8)).toUpperCase(),
    affiliateTier: me.affiliate_tier as "standard" | "founding",
    monthKey,
    directRows,
    tier2Rows,
    totalReferred: allReferredCount,
    directCount: directRows.length,
    tier2Count: tier2Rows.length,
    activeCount,
    totalMonthlyCents,
    tier1MonthlyCents,
    tier2MonthlyCents,
  };
}
