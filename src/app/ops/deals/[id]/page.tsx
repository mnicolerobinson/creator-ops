import { notFound } from "next/navigation";
import { normalizeRole, requireOps } from "@/lib/auth/guards";
import { OpsClientMessages } from "../../client-messages";

function formatMoney(cents: number | null) {
  if (!cents) return "Budget unknown";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export default async function OpsDealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, profile, user } = await requireOps();

  const { data: deal } = await supabase
    .from("deals")
    .select(
      "id, client_id, primary_contact_id, company_id, assigned_persona_id, title, stage, qualification_reason, qualification_score, quoted_amount_cents, campaign_type, platforms, created_at",
    )
    .eq("id", id)
    .single();

  if (!deal) {
    notFound();
  }

  if (normalizeRole(profile?.role) !== "superadmin") {
    const { data: access } = await supabase
      .from("user_clients")
      .select("client_id")
      .eq("user_id", user.id)
      .eq("client_id", deal.client_id)
      .maybeSingle();
    if (!access) {
      notFound();
    }
  }

  const [{ data: company }, { data: contact }, { data: persona }, { data: client }] =
    await Promise.all([
      deal.company_id
        ? supabase.from("companies").select("name, website").eq("id", deal.company_id).maybeSingle()
        : Promise.resolve({ data: null }),
      deal.primary_contact_id
        ? supabase
            .from("contacts")
            .select("full_name, title, email")
            .eq("id", deal.primary_contact_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      deal.assigned_persona_id
        ? supabase
            .from("personas")
            .select("display_name, title")
            .eq("id", deal.assigned_persona_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("clients").select("name").eq("id", deal.client_id).maybeSingle(),
    ]);

  const { data: messages } = await supabase
    .from("messages")
    .select(
      "id, direction, status, subject, body_text, from_address, to_addresses, created_at, received_at, sent_at",
    )
    .eq("deal_id", id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-6 shadow-2xl shadow-black/30">
        <p className="text-xs uppercase tracking-[0.35em] text-[#C8102E]">
          Deal detail
        </p>
        <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-[#F7F0E8]">
          {company?.name ?? deal.title}
        </h1>
        <p className="mt-2 text-sm text-[#B0A89A]">
          {client?.name} · {deal.campaign_type ?? "Campaign unknown"} ·{" "}
          {formatMoney(deal.quoted_amount_cents)}
        </p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-[#C8102E]/40 bg-[#C8102E]/15 px-3 py-1 text-[#FFCED6]">
            {deal.stage}
          </span>
          <span className="rounded-full border border-[#B0A89A]/30 px-3 py-1 text-[#B0A89A]">
            {persona?.display_name ?? "No persona"}
          </span>
          {deal.qualification_score != null ? (
            <span className="rounded-full border border-[#B0A89A]/30 px-3 py-1 text-[#B0A89A]">
              Fit {Number(deal.qualification_score).toFixed(2)}
            </span>
          ) : null}
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8F8678]">Contact</p>
          <p className="mt-3 font-medium text-[#F7F0E8]">
            {contact?.full_name ?? "Unknown sender"}
          </p>
          <p className="mt-1 text-sm text-[#B0A89A]">{contact?.title}</p>
          <p className="mt-1 text-sm text-[#B0A89A]">{contact?.email}</p>
        </div>
        <div className="rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8F8678]">Brand</p>
          <p className="mt-3 font-medium text-[#F7F0E8]">
            {company?.name ?? "Unknown brand"}
          </p>
          <p className="mt-1 text-sm text-[#B0A89A]">{company?.website}</p>
        </div>
        <div className="rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8F8678]">Platforms</p>
          <p className="mt-3 text-sm text-[#B0A89A]">
            {(deal.platforms ?? []).join(", ") || "Not specified"}
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-2xl font-semibold text-[#F7F0E8]">
          Message timeline
        </h2>
        <ul className="space-y-4">
          {(messages ?? []).map((message) => (
            <li
              key={message.id}
              className="rounded-2xl border border-[#2A211C] bg-[#0B0B0B] p-5 text-sm"
            >
              <p className="font-medium text-[#F7F0E8]">
                {message.direction} · {message.status}
              </p>
              <p className="mt-1 text-xs text-[#8F8678]">
                {message.from_address ? `From ${message.from_address}` : ""}
                {message.to_addresses?.length
                  ? ` · To ${message.to_addresses.join(", ")}`
                  : ""}
                {" · "}
                {new Date(
                  message.received_at ?? message.sent_at ?? message.created_at,
                ).toLocaleString()}
              </p>
              {message.subject ? (
                <p className="mt-3 text-[#F7F0E8]">{message.subject}</p>
              ) : null}
              {message.body_text ? (
                <p className="mt-3 whitespace-pre-wrap text-[#B0A89A]">
                  {message.body_text}
                </p>
              ) : null}
            </li>
          ))}
          {(!messages || messages.length === 0) && (
            <li className="text-sm text-[#8F8678]">No messages yet.</li>
          )}
        </ul>
      </section>

      <OpsClientMessages
        clientId={deal.client_id}
        clientName={client?.name ?? "Client"}
      />
    </div>
  );
}
