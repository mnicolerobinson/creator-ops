import Link from "next/link";
import { requireOps } from "@/lib/auth/guards";
import { getOpsAllowedClientIds } from "@/lib/ops/client-access";

export default async function OpsClientsPage() {
  const { supabase, profile, user } = await requireOps();
  const allowed = await getOpsAllowedClientIds(supabase, user.id, profile?.role);

  let q = supabase
    .from("clients")
    .select(
      "id, name, creator_display_name, status, subscription_tier, subscription_status, wizard_step, created_at, onboarding_completed_at, stripe_customer_id",
    )
    .order("created_at", { ascending: false });

  if (allowed) {
    if (allowed.length === 0) {
      q = q.in("id", ["00000000-0000-0000-0000-000000000000"] as string[]);
    } else {
      q = q.in("id", allowed);
    }
  }

  const { data: clients } = await q;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#C8102E]">Directory</p>
        <h1 className="mt-3 font-[var(--font-cormorant)] text-4xl font-light text-[#F7F0E8]">
          Clients
        </h1>
        <p className="mt-2 text-sm text-[#8F8678]">
          All creator workspaces you can access. Operators see assigned accounts; superadmin sees
          all.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#2A211C] bg-[#0B0B0B]">
        <div className="grid grid-cols-12 border-b border-[#2A211C] px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
          <div className="col-span-3">Creator</div>
          <div className="col-span-2">Business name</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Subscription</div>
          <div className="col-span-1">Wizard</div>
          <div className="col-span-2 text-right">Created</div>
        </div>
        <div className="divide-y divide-[#1D1713]">
          {(clients ?? []).map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-12 items-center gap-2 px-4 py-3.5 text-sm"
            >
              <div className="col-span-3">
                <p className="font-medium text-[#F7F0E8]">{c.creator_display_name}</p>
                <p className="text-xs text-[#5c544a]">ID {c.id.slice(0, 8)}…</p>
              </div>
              <div className="col-span-2 text-[#B0A89A]">{c.name}</div>
              <div className="col-span-2">
                <span className="rounded-full border border-[#2A211C] px-2.5 py-0.5 text-xs text-[#B0A89A]">
                  {c.status}
                </span>
              </div>
              <div className="col-span-2 text-xs text-[#8F8678]">
                <p>{c.subscription_tier?.replace(/_/g, " ") ?? "—"}</p>
                <p className="text-[#5c544a]">{c.subscription_status ?? ""}</p>
              </div>
              <div className="col-span-1 text-xs text-[#6F675E]">{c.wizard_step ?? 1}/7</div>
              <div className="col-span-2 text-right text-xs text-[#6F675E]">
                {c.created_at ? new Date(c.created_at).toLocaleString() : "—"}
              </div>
            </div>
          ))}
        </div>
        {(!clients || clients.length === 0) && (
          <p className="px-4 py-12 text-center text-sm text-[#6F675E]">No clients in your scope.</p>
        )}
      </div>

      <p className="text-center text-xs text-[#5c544a]">
        <Link href="/ops" className="text-[#C9A84C] hover:underline">
          ← Ops home
        </Link>
      </p>
    </div>
  );
}
