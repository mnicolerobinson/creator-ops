import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function OpsDealsPage() {
  const supabase = await createServerSupabaseClient();

  const { data: deals } = await supabase
    .from("deals")
    .select("id, title, stage, qualification_status, fit_score, updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Deals</h1>
        <p className="mt-2 text-sm text-zinc-600">
          All opportunities across creator accounts.
        </p>
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-zinc-200 text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">
                Title
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">
                Stage
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">
                Qualification
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">
                Fit
              </th>
              <th className="px-4 py-3 text-left font-medium text-zinc-700">
                Updated
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {(deals ?? []).map((d) => (
              <tr key={d.id} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <Link
                    href={`/ops/deals/${d.id}`}
                    className="font-medium text-zinc-900 underline-offset-2 hover:underline"
                  >
                    {d.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-700">{d.stage}</td>
                <td className="px-4 py-3 text-zinc-700">
                  {d.qualification_status}
                </td>
                <td className="px-4 py-3 text-zinc-700">
                  {d.fit_score != null ? Number(d.fit_score).toFixed(3) : "—"}
                </td>
                <td className="px-4 py-3 text-zinc-600">
                  {d.updated_at
                    ? new Date(d.updated_at).toLocaleString()
                    : "—"}
                </td>
              </tr>
            ))}
            {(!deals || deals.length === 0) && (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-zinc-500"
                >
                  No deals yet. POST to{" "}
                  <code className="rounded bg-zinc-100 px-1">
                    /api/webhooks/intake
                  </code>{" "}
                  to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
