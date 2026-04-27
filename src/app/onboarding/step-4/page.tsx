import Link from "next/link";
import { saveBrandPreferences } from "../actions";
import { StepShell } from "../_components";

const blockedCategories = ["Gambling", "Crypto", "Tobacco", "Firearms", "MLM", "Alcohol"];

export default function OnboardingStepFour() {
  return (
    <StepShell
      eyebrow="Step 4 of 7"
      title="Brand preferences"
      body="Set the boundaries Sarah should enforce before a brand reaches your inbox."
    >
      <form action={saveBrandPreferences} className="space-y-6">
        <fieldset className="space-y-3 rounded-2xl border border-[#C9A84C]/25 bg-[#0B0B0B] p-4">
          <legend className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#C9A84C]">
            Blocked categories
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {blockedCategories.map((category) => (
              <label key={category} className="flex items-center gap-3 rounded-xl bg-[#141414] p-3 text-sm">
                <input
                  type="checkbox"
                  name="blocked_categories"
                  value={category}
                  defaultChecked
                  className="h-4 w-4 accent-[#C8102E]"
                />
                {category}
              </label>
            ))}
          </div>
        </fieldset>

        <label className="block text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
          Brands to always decline
          <input
            name="always_decline"
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base normal-case tracking-normal text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
            placeholder="Brand names, separated by commas"
          />
        </label>

        <label className="block text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
          Brands to always accept
          <input
            name="always_accept"
            className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base normal-case tracking-normal text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
            placeholder="Brand names, separated by commas"
          />
        </label>

        <div className="flex flex-col gap-3 pt-2">
          <button className="rounded-full bg-[#C8102E] px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-white transition hover:bg-[#8B0000]">
            Save and Continue
          </button>
          <div className="flex items-center justify-between text-sm text-[#B0A89A]">
            <Link href="/onboarding/step-3">Back</Link>
            <Link href="/dashboard">Save and continue later</Link>
          </div>
        </div>
      </form>
    </StepShell>
  );
}
