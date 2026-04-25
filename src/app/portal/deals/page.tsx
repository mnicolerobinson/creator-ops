import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PortalDealsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: access } = user
    ? await supabase
        .from("user_clients")
        .select("client_id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle()
    : { data: null };

  const clientId = access?.client_id;
  const { data: deals } = clientId
    ? await supabase
        .from("deals")
        .select("id, title, stage, qualification_reason, updated_at")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
    : { data: [] as { id: string; title: string; stage: string; qualification_reason: string | null; updated_at: string | null }[] };

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
                {d.stage} · {d.qualification_reason ?? "Qualification pending"}
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
