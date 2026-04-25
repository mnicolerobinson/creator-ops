import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function PortalHomePage() {
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
  let dealCount = 0;
  let openInvoices = 0;

  if (clientId) {
    const { count: dc } = await supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId);
    dealCount = dc ?? 0;

    const { count: ic } = await supabase
      .from("invoices")
      .select("*", { count: "exact", head: true })
      .eq("client_id", clientId)
      .in("status", ["draft", "open"]);
    openInvoices = ic ?? 0;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Pipeline status, documents, and billing — without internal agent detail.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm font-medium text-zinc-500">Active deals</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900">
            {dealCount}
          </p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4">
          <p className="text-sm font-medium text-zinc-500">Open invoices</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-zinc-900">
            {openInvoices}
          </p>
        </div>
      </div>

      <section className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-600">
        <p className="font-medium text-zinc-800">Monthly summary</p>
        <p className="mt-2">
          Period reporting will aggregate autonomous actions and outcomes here
          (no agent scores or internal system data).
        </p>
      </section>
    </div>
  );
}
