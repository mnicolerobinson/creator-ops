import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: access } = await supabase
    .from("user_clients")
    .select("client_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!access?.client_id) redirect("/login?error=auth");

  const { data: client } = await supabase
    .from("clients")
    .select("creator_display_name, wizard_step, status")
    .eq("id", access.client_id)
    .single();

  if (client && client.status === "onboarding" && (client.wizard_step ?? 1) < 7) {
    redirect(`/onboarding/step-${client.wizard_step ?? 1}`);
  }

  const { count: activeDeals } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("client_id", access.client_id)
    .not("stage", "in", "(completed,declined,lost)");

  const { data: personaLink } = await supabase
    .from("client_personas")
    .select("personas(display_name,title,sending_email)")
    .eq("client_id", access.client_id)
    .eq("is_primary", true)
    .maybeSingle();
  const persona = Array.isArray(personaLink?.personas)
    ? personaLink?.personas[0]
    : personaLink?.personas;

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-8 text-[#FAFAFA]">
      <div className="mx-auto max-w-5xl">
        <header className="flex items-center justify-between gap-4">
          <p className="font-[var(--font-bebas)] text-3xl tracking-[0.18em]">
            <span>Creatr</span>
            <span className="text-[#C8102E]">Ops</span>
          </p>
          <Link href="/portal" className="text-[11px] uppercase tracking-[0.25em] text-[#C9A84C]">
            Portal
          </Link>
        </header>

        <section className="mt-14">
          <p className="text-[11px] uppercase tracking-[0.35em] text-[#C9A84C]">
            Creator dashboard
          </p>
          <h1 className="mt-4 font-[var(--font-cormorant)] text-5xl font-light">
            {client?.creator_display_name ?? "Your"} operations are live.
          </h1>
        </section>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-[#141414] p-5">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#B0A89A]">
              Active deals
            </p>
            <p className="mt-4 font-[var(--font-bebas)] text-6xl tracking-wider text-[#C8102E]">
              {activeDeals ?? 0}
            </p>
          </div>
          <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#141414] p-5">
            <p className="text-[11px] uppercase tracking-[0.25em] text-[#B0A89A]">
              Account manager
            </p>
            <p className="mt-4 font-[var(--font-cormorant)] text-3xl">
              {persona?.display_name ?? "Sarah Chen"}
            </p>
            <p className="mt-1 text-sm text-[#B0A89A]">
              {persona?.title ?? "Partnerships Lead"} · {persona?.sending_email ?? "sarah@ops.creatrops.com"}
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
