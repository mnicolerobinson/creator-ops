import { createServerSupabaseClient } from "@/lib/supabase/server";
import { saveRateCardWithoutRedirect } from "../actions";
import { getOnboardingData } from "../data";
import { StepShell } from "../_components";
import { WizardForm } from "../wizard-form";

const campaignTypes = [
  ["rate_instagram_reel", "Instagram Reel"],
  ["rate_story", "Story"],
  ["rate_tiktok_video", "TikTok Video"],
  ["rate_youtube_dedicated", "YouTube Dedicated"],
  ["rate_youtube_integration", "YouTube Integration"],
  ["rate_blog_post", "Blog Post"],
  ["rate_podcast", "Podcast"],
];

const benchmarkByNiche: Record<string, string[]> = {
  Beauty: ["Instagram Reel: $750-$2,000", "TikTok Video: $600-$1,800", "Story: $250-$750"],
  Fashion: ["Instagram Reel: $800-$2,500", "TikTok Video: $700-$2,000", "YouTube Integration: $1,500-$4,000"],
  Fitness: ["Instagram Reel: $600-$1,800", "TikTok Video: $500-$1,500", "YouTube Dedicated: $2,000-$6,000"],
  Lifestyle: ["Instagram Reel: $750-$2,250", "TikTok Video: $650-$1,800", "Story: $250-$700"],
  Food: ["Instagram Reel: $600-$1,700", "TikTok Video: $500-$1,500", "Blog Post: $500-$1,250"],
  Travel: ["Instagram Reel: $900-$2,750", "YouTube Dedicated: $2,500-$7,500", "Story: $300-$900"],
  Tech: ["YouTube Dedicated: $3,000-$10,000", "YouTube Integration: $1,500-$5,000", "TikTok Video: $800-$2,500"],
  Finance: ["YouTube Dedicated: $4,000-$12,000", "YouTube Integration: $2,000-$6,000", "Podcast: $1,500-$5,000"],
  Parenting: ["Instagram Reel: $650-$1,900", "TikTok Video: $550-$1,700", "Blog Post: $500-$1,500"],
  Entertainment: ["TikTok Video: $750-$2,500", "Instagram Reel: $800-$2,500", "YouTube Integration: $1,500-$4,500"],
  Other: ["Instagram Reel: $600-$2,000", "TikTok Video: $500-$1,800", "YouTube Integration: $1,500-$4,000"],
};

async function getSavedNiche() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Lifestyle";

  const { data: access } = await supabase
    .from("user_clients")
    .select("client_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!access?.client_id) return "Lifestyle";

  const { data: client } = await supabase
    .from("clients")
    .select("niche")
    .eq("id", access.client_id)
    .maybeSingle();

  return client?.niche ?? "Lifestyle";
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function centsToDollars(value: unknown) {
  return typeof value === "number" ? String(value / 100) : "";
}

export default async function OnboardingStepThree() {
  const [{ policy }, niche] = await Promise.all([getOnboardingData(), getSavedNiche()]);
  const rateCard = asRecord(policy.rate_card);
  const rates = asRecord(rateCard.rates_cents);
  const benchmarks = benchmarkByNiche[niche] ?? benchmarkByNiche.Other;

  return (
    <StepShell
      eyebrow="Step 3 of 7"
      title="Rate card"
      body="Set your minimums so Sarah knows what to accept, negotiate, or escalate."
    >
      <WizardForm
        action={saveRateCardWithoutRedirect}
        backHref="/onboarding/step-2"
        nextHref="/onboarding/step-4"
      >
        <label className="block rounded-2xl border border-[#C9A84C]/30 bg-[#0B0B0B] p-4 text-[11px] font-medium uppercase tracking-[0.25em] text-[#C9A84C]">
          Minimum budget to respond to
          <input
            name="minimum_budget"
            type="number"
            min="0"
            step="50"
            required
            defaultValue={centsToDollars(rateCard.minimum_budget_cents)}
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base normal-case tracking-normal text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
            placeholder="500"
          />
        </label>

        <div className="rounded-2xl border border-white/10 bg-[#141414] p-4">
          <p className="text-[11px] uppercase tracking-[0.25em] text-[#B0A89A]">
            Benchmarks for {niche}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-[#C9A84C]">
            {benchmarks.map((benchmark) => (
              <li key={benchmark}>{benchmark}</li>
            ))}
          </ul>
        </div>

        <fieldset className="space-y-4">
          <legend className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
            Rate per campaign type
          </legend>
          {campaignTypes.map(([name, label]) => (
            <label key={name} className="block text-sm text-[#B0A89A]">
              {label}
              <input
                name={name}
                type="number"
                min="0"
                step="50"
                defaultValue={centsToDollars(rates[String(name)])}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
                placeholder="Rate in USD"
              />
            </label>
          ))}
        </fieldset>

        <label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-[#0B0B0B] p-4 text-sm text-[#B0A89A]">
          <input
            name="set_up_later"
            type="checkbox"
            defaultChecked={rateCard.set_up_later === true}
            className="mt-1 h-4 w-4 accent-[#C8102E]"
          />
          <span>Set this up later. Sarah will escalate all rate decisions until your card is complete.</span>
        </label>

      </WizardForm>
    </StepShell>
  );
}
