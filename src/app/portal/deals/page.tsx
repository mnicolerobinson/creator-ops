import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PortalDealsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("creator_id")
        .eq("id", user.id)
        .single()
    : { data: null };

  const creatorId = profile?.creator_id;
  const { data: deals } = creatorId
    ? await supabase
        .from("deals")
        .select("id, title, stage, qualification_status, updated_at")
        .eq("creator_id", creatorId)
        .order("updated_at", { ascending: false })
    : { data: [] as { id: string; title: string; stage: string; qualification_status: string; updated_at: string | null }[] };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your deals</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Outcomes and stages — not internal automation detail.
        </p>
      </div>
      <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200">
        {(deals ?? []).map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="font-medium text-zinc-900">{d.title}</p>
              <p className="text-sm text-zinc-600">
                {d.stage} · {d.qualification_status}
              </p>
            </div>
            <Link
              href={`/portal/deals/${d.id}`}
              className="text-sm font-medium text-zinc-900 underline"
            >
              View
            </Link>
          </li>
        ))}
        {(!deals || deals.length === 0) && (
          <li className="px-4 py-8 text-center text-sm text-zinc-500">
            No deals linked to your account yet.
          </li>
        )}
      </ul>
    </div>
  );
}
