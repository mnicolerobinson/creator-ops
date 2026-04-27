import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCreator } from "@/lib/auth/guards";
import { CreatorMessagesPanel } from "../../dashboard-client";

function formatCurrency(cents: number | null | undefined) {
  if (cents == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function StagePill({ stage }: { stage: string }) {
  const color =
    stage === "completed" || stage === "paid"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : stage === "declined" || stage === "lost"
        ? "border-zinc-500/30 bg-zinc-700/30 text-zinc-300"
        : "border-[#C8102E]/40 bg-[#C8102E]/15 text-[#FFCED6]";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs capitalize ${color}`}>
      {stage.replace(/_/g, " ")}
    </span>
  );
}

export default async function PortalDealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, clientAccess } = await requireCreator();
  const clientId = clientAccess?.client_id;
  if (!clientId) notFound();

  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, client_id, company_id, title, stage, campaign_type, quoted_amount_cents, due_date, updated_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!deal || deal.client_id !== clientId) {
    notFound();
  }

  const [
    { data: company },
    { data: messages },
    { data: documents },
    { data: tasks },
    { data: stageHistory },
    { data: personaLink },
  ] = await Promise.all([
    deal.company_id
      ? supabase.from("companies").select("id, name, website").eq("id", deal.company_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("messages")
      .select(
        "id, direction, channel, status, subject, body_text, from_address, to_addresses, created_at, received_at, sent_at",
      )
      .eq("deal_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("documents")
      .select("id, kind, status, title, storage_path, created_at, updated_at")
      .eq("deal_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, kind, status, title, body, due_at, completed_at, created_at")
      .eq("deal_id", id)
      .order("due_at", { ascending: true }),
    supabase
      .from("deal_stage_history")
      .select("id, from_stage, to_stage, reason, created_at")
      .eq("deal_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("client_personas")
      .select("personas(display_name,title,sending_email)")
      .eq("client_id", clientId)
      .eq("is_primary", true)
      .maybeSingle(),
  ]);

  const accountManager = Array.isArray(personaLink?.personas)
    ? personaLink?.personas[0]
    : personaLink?.personas;
  const brandName = company?.name ?? deal.title;
  const dueLabel = deal.due_date
    ? new Date(`${deal.due_date}T00:00:00`).toLocaleDateString()
    : "Not set";

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/portal/deals"
            className="text-xs uppercase tracking-[0.2em] text-[#8F8678] transition hover:text-[#C9A84C]"
          >
            ← All deals
          </Link>
          <Link
            href="/dashboard"
            className="text-xs uppercase tracking-[0.2em] text-[#8F8678] transition hover:text-[#C9A84C]"
          >
            Dashboard
          </Link>
        </div>

        <header className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-6 shadow-2xl shadow-black/30">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-[#C9A84C]/40 bg-[#130D0A]">
                <Image src="/logo.png" alt="CreatrOps" width={40} height={40} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.35em] text-[#C9A84C]">Deal</p>
                <h1 className="mt-1 font-[var(--font-cormorant)] text-4xl font-light text-[#F7F0E8]">
                  {brandName}
                </h1>
                <p className="mt-2 text-sm text-[#B0A89A]">
                  {deal.campaign_type ?? "Campaign type not set"} · {formatCurrency(deal.quoted_amount_cents)}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <StagePill stage={deal.stage} />
                  <span className="text-sm text-[#8F8678]">Due {dueLabel}</span>
                </div>
              </div>
            </div>
            <div className="w-full min-w-[220px] max-w-sm rounded-2xl border border-[#2A211C] bg-[#050505] p-4">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#8F8678]">Account manager</p>
              <p className="mt-2 font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">
                {accountManager?.display_name ?? "Sarah Chen"}
              </p>
              <p className="text-sm text-[#B0A89A]">{accountManager?.title ?? "Partnerships Lead"}</p>
              <CreatorMessagesPanel
                clientId={clientId}
                accountManagerName={accountManager?.display_name ?? "Sarah Chen"}
              />
            </div>
          </div>
        </header>

        <section className="mt-8 space-y-4">
          <h2 className="font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">Message timeline</h2>
          <p className="text-sm text-[#8F8678]">Inbound and outbound email for this deal</p>
          <ul className="space-y-3">
            {(messages ?? []).map((message) => (
              <li
                key={message.id}
                className={`rounded-2xl border p-4 text-sm ${
                  message.direction === "outbound"
                    ? "border-[#C8102E]/35 bg-[#1A0A0D]"
                    : "border-[#2A211C] bg-[#0B0B0B]"
                }`}
              >
                <p className="font-medium text-[#F7F0E8]">
                  {message.direction} · {message.channel}
                  {message.status ? ` · ${message.status}` : ""}
                </p>
                <p className="mt-1 text-xs text-[#8F8678]">
                  {message.from_address ? `From ${message.from_address}` : ""}
                  {message.to_addresses?.length ? ` · To ${message.to_addresses.join(", ")}` : ""}
                  {" · "}
                  {new Date(
                    message.received_at ?? message.sent_at ?? message.created_at,
                  ).toLocaleString()}
                </p>
                {message.subject ? <p className="mt-2 text-[#C9A84C]">{message.subject}</p> : null}
                {message.body_text ? (
                  <p className="mt-2 whitespace-pre-wrap text-[#B0A89A]">{message.body_text}</p>
                ) : null}
              </li>
            ))}
            {(!messages || messages.length === 0) && (
              <li className="rounded-2xl border border-dashed border-[#2A211C] p-6 text-sm text-[#8F8678]">
                No messages on this deal yet.
              </li>
            )}
          </ul>
        </section>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
            <h2 className="font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">Documents</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {(documents ?? []).map((doc) => (
                <li
                  key={doc.id}
                  className="rounded-2xl border border-[#2A211C] bg-[#050505] px-4 py-3"
                >
                  <p className="font-medium text-[#F7F0E8]">{doc.title}</p>
                  <p className="mt-1 text-xs text-[#8F8678]">
                    {doc.kind} · {doc.status}
                    {doc.storage_path ? ` · ${doc.storage_path.split("/").pop()}` : ""}
                  </p>
                </li>
              ))}
              {(!documents || documents.length === 0) && (
                <li className="text-[#8F8678]">No documents yet.</li>
              )}
            </ul>
          </section>

          <section className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
            <h2 className="font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">Next steps / tasks</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {(tasks ?? []).map((task) => (
                <li
                  key={task.id}
                  className="rounded-2xl border border-[#2A211C] bg-[#050505] px-4 py-3"
                >
                  <p className="font-medium text-[#F7F0E8]">{task.title}</p>
                  <p className="mt-1 text-xs text-[#8F8678]">
                    {task.kind} · {task.status} · due{" "}
                    {new Date(task.due_at).toLocaleString()}
                  </p>
                  {task.body ? <p className="mt-2 text-[#B0A89A]">{task.body}</p> : null}
                </li>
              ))}
              {(!tasks || tasks.length === 0) && (
                <li className="text-[#8F8678]">No tasks for this deal yet.</li>
              )}
            </ul>
          </section>
        </div>

        <section className="mt-8 rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
          <h2 className="font-[var(--font-cormorant)] text-2xl text-[#F7F0E8]">Stage history</h2>
          <ol className="mt-4 space-y-3 border-l border-[#2A211C] pl-6 text-sm">
            {(stageHistory ?? []).map((row) => (
              <li key={row.id} className="relative">
                <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-[#C9A84C]" />
                <p className="text-[#F7F0E8]">
                  {row.from_stage ? (
                    <>
                      <span className="capitalize text-[#B0A89A]">
                        {String(row.from_stage).replace(/_/g, " ")}
                      </span>
                      <span className="text-[#6F675E]"> → </span>
                    </>
                  ) : null}
                  <span className="font-medium capitalize">
                    {String(row.to_stage).replace(/_/g, " ")}
                  </span>
                </p>
                <p className="mt-1 text-xs text-[#8F8678]">
                  {new Date(row.created_at).toLocaleString()}
                  {row.reason ? ` — ${row.reason}` : ""}
                </p>
              </li>
            ))}
            {(!stageHistory || stageHistory.length === 0) && (
              <li className="text-[#8F8678]">No stage changes recorded yet.</li>
            )}
          </ol>
        </section>
      </div>
    </main>
  );
}
