import { saveBrandPreferencesWithoutRedirect } from "../actions";
import { StepShell } from "../_components";
import { WizardForm } from "../wizard-form";

const blockedCategories = ["Gambling", "Crypto", "Tobacco", "Firearms", "MLM", "Alcohol"];

export default function OnboardingStepFour() {
  return (
    <StepShell
      eyebrow="Step 4 of 7"
      title="Brand preferences"
      body="Set the boundaries Sarah should enforce before a brand reaches your inbox."
    >
      <WizardForm
        action={saveBrandPreferencesWithoutRedirect}
        backHref="/onboarding/step-3"
        nextHref="/onboarding/step-5"
      >
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

      </WizardForm>
    </StepShell>
  );
}
