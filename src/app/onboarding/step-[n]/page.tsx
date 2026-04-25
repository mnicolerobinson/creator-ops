import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { saveAndContinueLater, saveOnboardingStep } from "../actions";

const niches = [
  "Beauty",
  "Fashion",
  "Fitness",
  "Lifestyle",
  "Food",
  "Travel",
  "Tech",
  "Finance",
  "Parenting",
  "Entertainment",
  "Other",
];

const platforms = ["TikTok", "Instagram", "YouTube", "Twitter/X", "Pinterest", "Snapchat"];
const blockedCategories = ["Gambling", "Crypto", "Tobacco", "Firearms", "MLM", "Alcohol"];
const campaignTypes = [
  ["instagram_reel", "Instagram Reel"],
  ["story", "Story"],
  ["tiktok_video", "TikTok Video"],
  ["youtube_dedicated", "YouTube Dedicated"],
  ["youtube_integration", "YouTube Integration"],
  ["blog_post", "Blog Post"],
  ["podcast", "Podcast"],
];

function Logo() {
  return (
    <div>
      <p className="font-[var(--font-bebas)] text-3xl tracking-[0.18em]">
        <span>Creatr</span>
        <span className="text-[#C8102E]">Ops</span>
      </p>
      <p className="mt-1 text-[9px] uppercase tracking-[0.45em] text-[#C9A84C]">
        by Clairen Haus
      </p>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string | number | null;
  required?: boolean;
}) {
  return (
    <label className="block text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue ?? ""}
        className="mt-2 w-full rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-base normal-case tracking-normal text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
}: {
  label: string;
  name: string;
  options: string[];
}) {
  return (
    <label className="block text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
      {label}
      <select
        name={name}
        className="mt-2 w-full rounded-xl border border-white/10 bg-[#1A1A1A] px-4 py-3 text-base normal-case tracking-normal text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckboxGrid({
  name,
  options,
}: {
  name: string;
  options: string[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((option) => (
        <label
          key={option}
          className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#141414] px-3 py-3 text-sm text-[#FAFAFA]"
        >
          <input name={name} type="checkbox" value={option.toLowerCase().replace(/[^a-z]/g, "_")} />
          {option}
        </label>
      ))}
    </div>
  );
}

function StepBody({
  step,
  client,
  persona,
  referralCode,
}: {
  step: number;
  client: Record<string, any>;
  persona: Record<string, any> | null;
  referralCode: string | null;
}) {
  if (step === 1) {
    return (
      <>
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#C9A84C]">
          Step 1 of 7
        </p>
        <h1 className="mt-4 font-[var(--font-cormorant)] text-5xl font-light leading-none">
          Your operations team is being assembled.
        </h1>
        <p className="mt-5 text-sm leading-8 text-[#B0A89A]">
          Your {client.subscription_tier?.replaceAll("_", " ") ?? "selected"} plan is active.
          Confirm the setup and we will move into your creator profile.
        </p>
      </>
    );
  }

  if (step === 2) {
    return (
      <>
        <h1 className="font-[var(--font-cormorant)] text-4xl font-light">Creator profile</h1>
        <Field label="Display name" name="display_name" defaultValue={client.creator_display_name} required />
        <SelectField label="Primary niche" name="niche" options={niches} />
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-[#B0A89A]">
            Primary platforms
          </p>
          <CheckboxGrid name="platforms" options={platforms} />
        </div>
        <Field label="TikTok handle" name="handle_tiktok" defaultValue={client.handle_tiktok} />
        <Field label="Instagram handle" name="handle_instagram" defaultValue={client.handle_instagram} />
        <Field label="YouTube handle" name="handle_youtube" defaultValue={client.handle_youtube} />
        <SelectField
          label="Follower count range"
          name="follower_count_range"
          options={["Under 25K", "25K-100K", "100K-250K", "250K-500K", "500K-1M", "1M+"]}
        />
      </>
    );
  }

  if (step === 3) {
    return (
      <>
        <h1 className="font-[var(--font-cormorant)] text-4xl font-light">Rate card</h1>
        <Field label="Minimum budget to respond to" name="minimum_budget_cents" type="number" placeholder="150000" />
        <div className="space-y-3">
          {campaignTypes.map(([key, label]) => (
            <Field key={key} label={`${label} rate`} name={`rate_${key}`} type="number" placeholder="0" />
          ))}
        </div>
        <label className="flex items-center gap-3 text-sm text-[#B0A89A]">
          <input name="setup_later" type="checkbox" />
          Set this up later and escalate rate decisions.
        </label>
      </>
    );
  }

  if (step === 4) {
    return (
      <>
        <h1 className="font-[var(--font-cormorant)] text-4xl font-light">Brand preferences</h1>
        <div>
          <p className="mb-3 text-[11px] uppercase tracking-[0.25em] text-[#B0A89A]">
            Blocked categories
          </p>
          <CheckboxGrid name="blocked_categories" options={blockedCategories} />
        </div>
        <Field label="Brands to always decline" name="decline_brands" placeholder="One per line" />
        <Field label="Brands to always accept" name="accept_brands" placeholder="One per line" />
      </>
    );
  }

  if (step === 5) {
    return (
      <>
        <h1 className="font-[var(--font-cormorant)] text-4xl font-light">Contract setup</h1>
        <SelectField label="Setup path" name="contract_path" options={["Upload existing contract", "Build from template"]} />
        <SelectField label="Payment terms" name="payment_terms" options={["Net 15", "Net 30", "50% upfront + 50% on delivery"]} />
        <SelectField label="Revision rounds" name="revision_rounds" options={["1", "2", "3"]} />
        <SelectField label="Exclusivity" name="exclusivity" options={["Never", "Sometimes", "Case by case"]} />
        <SelectField label="Usage rights duration" name="usage_rights_duration" options={["30 days", "60 days", "90 days"]} />
        <Field label="Governing state" name="governing_state" placeholder="New York" />
      </>
    );
  }

  if (step === 6) {
    const handle = client.handle_tiktok ?? client.handle_instagram ?? client.name;
    const email = `${String(handle).replace(/^@/, "").toLowerCase()}@ops.creatrops.com`;
    return (
      <>
        <h1 className="font-[var(--font-cormorant)] text-4xl font-light">Inbox setup</h1>
        <p className="text-sm leading-8 text-[#B0A89A]">
          Your dedicated brand inquiry email is{" "}
          <span className="text-[#C9A84C]">{email}</span>.
        </p>
        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#141414] p-4 text-sm leading-7 text-[#B0A89A]">
          <p>Gmail: Settings → Forwarding → Add forwarding address.</p>
          <p>iCloud: Mail settings → Forwarding → Forward my email to this address.</p>
          <p>Outlook: Settings → Mail → Forwarding → Enable forwarding.</p>
        </div>
        <p className="text-sm text-[#B0A89A]">
          Use “Continue” after you have sent a test inquiry to this address.
        </p>
      </>
    );
  }

  return (
    <>
      <h1 className="font-[var(--font-cormorant)] text-4xl font-light">You are live</h1>
      <div className="rounded-2xl border border-[#C9A84C]/30 bg-[#141414] p-5">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[#C9A84C]">
          Your account manager
        </p>
        <p className="mt-3 font-[var(--font-cormorant)] text-3xl">
          {persona?.display_name ?? "Sarah Chen"}
        </p>
        <p className="text-sm text-[#B0A89A]">
          {persona?.title ?? "Partnerships Lead"} · {persona?.sending_email ?? "sarah@ops.creatrops.com"}
        </p>
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#141414] p-5">
        <p className="text-[11px] uppercase tracking-[0.25em] text-[#B0A89A]">
          Referral link
        </p>
        <p className="mt-3 break-all text-sm text-[#FAFAFA]">
          https://creatrops.com/welcome?ref={referralCode ?? "generated-after-completion"}
        </p>
        <p className="mt-4 text-sm leading-7 text-[#B0A89A]">
          Refer one creator at Starter Ops and earn $100/month while they stay active.
        </p>
      </div>
    </>
  );
}

export default async function OnboardingStepPage({
  params,
}: {
  params: Promise<{ n: string }>;
}) {
  const { n } = await params;
  const step = Number(n);
  if (!Number.isInteger(step) || step < 1 || step > 7) notFound();

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
    .select("*")
    .eq("id", access.client_id)
    .single();
  if (!client) redirect("/login?error=auth");

  if ((client.wizard_step ?? 1) > step && step < 7) {
    redirect(`/onboarding/step-${client.wizard_step}`);
  }

  const { data: personaLink } = await supabase
    .from("client_personas")
    .select("personas(display_name,title,sending_email)")
    .eq("client_id", client.id)
    .eq("is_primary", true)
    .maybeSingle();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("referral_code")
    .eq("id", user.id)
    .single();
  const persona = Array.isArray(personaLink?.personas)
    ? personaLink?.personas[0]
    : personaLink?.personas;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] px-5 py-8 text-[#FAFAFA]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(200,16,46,0.2),transparent_34%),radial-gradient(circle_at_bottom,rgba(201,168,76,0.16),transparent_38%)]" />
      <div className="relative mx-auto max-w-xl">
        <div className="flex items-center justify-between gap-4">
          <Logo />
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#B0A89A]">
            {step}/7
          </span>
        </div>
        <div className="mt-8 h-1 rounded-full bg-white/10">
          <div
            className="h-1 rounded-full bg-[#C8102E]"
            style={{ width: `${(step / 7) * 100}%` }}
          />
        </div>

        <form action={saveOnboardingStep} className="mt-10 space-y-6">
          <input type="hidden" name="step" value={step} />
          <StepBody
            step={step}
            client={client}
            persona={persona ?? null}
            referralCode={profile?.referral_code ?? null}
          />

          <div className="flex flex-col gap-3 pt-4">
            <button className="rounded-full bg-[#C8102E] px-5 py-3 text-[11px] font-medium uppercase tracking-[0.25em] text-white transition hover:bg-[#8B0000]">
              {step === 7 ? "Go to dashboard" : "Continue"}
            </button>
            <div className="flex items-center justify-between text-sm text-[#B0A89A]">
              <Link href={`/onboarding/step-${Math.max(step - 1, 1)}`}>Back</Link>
              <button formAction={saveAndContinueLater}>Save and continue later</button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
