import { saveCreatorProfile } from "../actions";
import { StepShell } from "../_components";

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

export default function OnboardingStepTwo() {
  return (
    <StepShell
      eyebrow="Step 2 of 7"
      title="Creator profile"
      body="Tell your ops team how brands should see you and where your audience lives."
    >
      <form action={saveCreatorProfile} className="space-y-6">
        <label className="block text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
          Display name
          <input
            name="display_name"
            required
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base normal-case tracking-normal text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
            placeholder="How brands will see you"
          />
        </label>

        <label className="block text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
          Primary niche
          <select
            name="primary_niche"
            required
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base normal-case tracking-normal text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
            defaultValue=""
          >
            <option value="" disabled>
              Select your niche
            </option>
            {niches.map((niche) => (
              <option key={niche} value={niche}>
                {niche}
              </option>
            ))}
          </select>
        </label>

        <fieldset className="space-y-3 rounded-2xl border border-[#C9A84C]/25 bg-[#0B0B0B] p-4">
          <legend className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#C9A84C]">
            Primary platforms
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {platforms.map((platform) => (
              <label key={platform} className="flex items-center gap-3 rounded-xl bg-[#141414] p-3 text-sm">
                <input
                  type="checkbox"
                  name="primary_platforms"
                  value={platform}
                  className="h-4 w-4 accent-[#C8102E]"
                />
                {platform}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="space-y-3 rounded-2xl border border-white/10 bg-[#0B0B0B] p-4">
          <legend className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
            Follower count range per platform
          </legend>
          {platforms.map((platform) => (
            <label key={platform} className="block text-sm text-[#B0A89A]">
              {platform}
              <input
                name={`follower_count_${platform}`}
                className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
                placeholder="e.g. 50k-100k"
              />
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-3 pt-2">
          <button className="rounded-full bg-[#C8102E] px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-white transition hover:bg-[#8B0000]">
            Save and Continue
          </button>
          <a href="/dashboard" className="text-center text-sm text-[#B0A89A]">
            Save and continue later
          </a>
        </div>
      </form>
    </StepShell>
  );
}
