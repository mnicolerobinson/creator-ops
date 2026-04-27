import Link from "next/link";
import { requireOps } from "@/lib/auth/guards";
import { getOpsAllowedClientIds } from "@/lib/ops/client-access";
import { ClientsToolbar } from "./toolbar";

export default async function OpsClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; tier?: string }>;
}) {
  const sp = await searchParams;
  const { supabase, profile, user } = await requireOps();
  const allowed = await getOpsAllowedClientIds(supabase, user.id, profile?.role);

  let q = supabase
    .from("clients")
    .select(
      "id, name, creator_display_name, status, subscription_tier, wizard_step, updated_at, handle_instagram, handle_tiktok, handle_youtube, handle_twitter",
    )
    .order("updated_at", { ascending: false })
    .limit(600);

  if (allowed) {
    if (allowed.length === 0) {
      q = q.in("id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      q = q.in("id", allowed);
    }
  }

  if (sp.status) {
    q = q.eq("status", sp.status);
  }
  if (sp.tier) {
    q = q.eq("subscription_tier", sp.tier);
  }

  const { data: rows } = await q;

  let filtered = rows ?? [];
  const qq = (sp.q ?? "").trim().toLowerCase();
  if (qq) {
    filtered = filtered.filter(
      (c) =>
        (c.creator_display_name ?? "").toLowerCase().includes(qq) ||
        (c.name ?? "").toLowerCase().includes(qq) ||
        (c.handle_instagram ?? "").toLowerCase().includes(qq) ||
        (c.handle_tiktok ?? "").toLowerCase().includes(qq),
    );
  }

  const ids = filtered.map((c) => c.id);

  const [{ data: unreadRows }, { data: dealAgg }] = await Promise.all([
    ids.length
      ? supabase
          .from("creator_messages")
          .select("client_id")
          .in("client_id", ids)
          .eq("sender", "creator")
          .is("read_at", null)
      : Promise.resolve({ data: [] as { client_id: string }[] }),
    ids.length
      ? supabase
          .from("deals")
          .select("client_id, stage, updated_at")
          .in("client_id", ids)
      : Promise.resolve({
          data: [] as {
            client_id: string;
            stage: string;
            updated_at: string | null;
          }[],
        }),
  ]);

  const unreadCount = new Map<string, number>();
  for (const r of unreadRows ?? []) {
    unreadCount.set(r.client_id, (unreadCount.get(r.client_id) ?? 0) + 1);
  }

  const terminal = new Set(["completed", "declined", "lost", "paid"]);
  const activeDeals = new Map<string, number>();
  const lastDealActivity = new Map<string, string>();
  for (const d of dealAgg ?? []) {
    if (!terminal.has(d.stage)) {
      activeDeals.set(d.client_id, (activeDeals.get(d.client_id) ?? 0) + 1);
    }
    const cur = lastDealActivity.get(d.client_id);
    const u = d.updated_at ?? "";
    if (!cur || u > cur) lastDealActivity.set(d.client_id, u);
  }

  function handleStr(c: (typeof filtered)[0]) {
    return (
      [c.handle_instagram, c.handle_tiktok, c.handle_youtube, c.handle_twitter]
        .filter(Boolean)
        .join(" · ") || "—"
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#C8102E]">Directory</p>
        <h1 className="mt-3 font-[var(--font-cormorant)] text-4xl font-light text-[#F7F0E8]">
          Clients
        </h1>
        <p className="mt-2 text-sm text-[#8F8678]">
          Creator accounts you can access. Search and filter; open a row for full context.
        </p>
      </div>

      <ClientsToolbar />

      <div className="overflow-hidden rounded-2xl border border-[#2A211C] bg-[#0B0B0B]">
        <div className="hidden grid-cols-12 border-b border-[#2A211C] px-4 py-3 text-[10px] uppercase tracking-[0.18em] text-[#6F675E] lg:grid">
          <div className="col-span-2">Creator</div>
          <div className="col-span-2">Handle</div>
          <div className="col-span-1">Tier</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-1 text-center">Deals</div>
          <div className="col-span-2">Last activity</div>
          <div className="col-span-1 text-center">Unread</div>
          <div className="col-span-1 text-right">Actions</div>
        </div>
        <div className="divide-y divide-[#1D1713]">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-1 gap-2 px-4 py-4 text-sm lg:grid-cols-12 lg:items-center"
            >
              <div className="lg:col-span-2">
                <p className="font-medium text-[#F7F0E8]">{c.creator_display_name}</p>
                <p className="text-xs text-[#5c544a]">{c.name}</p>
              </div>
              <div className="truncate text-xs text-[#B0A89A] lg:col-span-2">{handleStr(c)}</div>
              <div className="lg:col-span-1">
                <span className="text-xs text-[#C9A84C]">
                  {c.subscription_tier?.replace(/_/g, " ") ?? "—"}
                </span>
              </div>
              <div className="lg:col-span-2">
                <span className="inline-flex rounded-full border border-[#2A211C] px-2.5 py-0.5 text-xs capitalize text-[#B0A89A]">
                  {c.status}
                </span>
              </div>
              <div className="text-center text-xs lg:col-span-1">{activeDeals.get(c.id) ?? 0}</div>
              <div className="text-xs text-[#6F675E] lg:col-span-2">
                {lastDealActivity.get(c.id)
                  ? new Date(lastDealActivity.get(c.id)!).toLocaleString()
                  : c.updated_at
                    ? new Date(c.updated_at).toLocaleString()
                    : "—"}
              </div>
              <div className="text-center lg:col-span-1">
                {(unreadCount.get(c.id) ?? 0) > 0 ? (
                  <span className="inline-flex min-w-[1.5rem] justify-center rounded-full bg-[#C8102E] px-2 py-0.5 text-[10px] font-bold text-white">
                    {unreadCount.get(c.id)}
                  </span>
                ) : (
                  <span className="text-[#5c544a]">—</span>
                )}
              </div>
              <div className="text-right lg:col-span-1">
                <Link
                  href={`/ops/clients/${c.id}`}
                  className="text-[10px] uppercase tracking-[0.2em] text-[#C9A84C] hover:underline"
                >
                  Open →
                </Link>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-12 text-center text-sm text-[#6F675E]">No clients match.</p>
          )}
        </div>
      </div>
    </div>
  );
}
