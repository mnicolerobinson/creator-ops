import { saveContractSetupWithoutRedirect } from "../actions";
import { getOnboardingData } from "../data";
import { StepShell } from "../_components";
import { WizardForm } from "../wizard-form";

const states = [
  "Alabama",
  "Alaska",
  "Arizona",
  "Arkansas",
  "California",
  "Colorado",
  "Connecticut",
  "Delaware",
  "Florida",
  "Georgia",
  "Hawaii",
  "Idaho",
  "Illinois",
  "Indiana",
  "Iowa",
  "Kansas",
  "Kentucky",
  "Louisiana",
  "Maine",
  "Maryland",
  "Massachusetts",
  "Michigan",
  "Minnesota",
  "Mississippi",
  "Missouri",
  "Montana",
  "Nebraska",
  "Nevada",
  "New Hampshire",
  "New Jersey",
  "New Mexico",
  "New York",
  "North Carolina",
  "North Dakota",
  "Ohio",
  "Oklahoma",
  "Oregon",
  "Pennsylvania",
  "Rhode Island",
  "South Carolina",
  "South Dakota",
  "Tennessee",
  "Texas",
  "Utah",
  "Vermont",
  "Virginia",
  "Washington",
  "West Virginia",
  "Wisconsin",
  "Wyoming",
];

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export default async function OnboardingStepFive() {
  const { policy } = await getOnboardingData();
  const contractSetup = asRecord(policy.contract_setup);
  const template = asRecord(contractSetup.template);
  const uploadedPdfRecord = asRecord(contractSetup.uploaded_pdf);
  const uploadedPdf: Record<string, unknown> = {
    ...uploadedPdfRecord,
    name: uploadedPdfRecord.name ?? contractSetup.uploaded_pdf_name,
  };
  const setupPath = String(contractSetup.setup_path ?? "template");

  return (
    <StepShell
      eyebrow="Step 5 of 7"
      title="Contract setup"
      body="Give Sarah the contract rules she should use when a brand is ready to move."
    >
      <WizardForm
        action={saveContractSetupWithoutRedirect}
        backHref="/onboarding/step-4"
        nextHref="/onboarding/step-6"
      >
        <fieldset className="space-y-3 rounded-2xl border border-[#C9A84C]/25 bg-[#0B0B0B] p-4">
          <legend className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#C9A84C]">
            Choose a contract path
          </legend>
          <label className="flex items-center gap-3 rounded-xl bg-[#141414] p-3 text-sm">
            <input
              type="radio"
              name="setup_path"
              value="upload_pdf"
              defaultChecked={setupPath === "upload_pdf"}
              className="h-4 w-4 accent-[#C8102E]"
            />
            Upload existing PDF
          </label>
          {uploadedPdf.name ? (
            <div className="rounded-xl border border-[#C9A84C]/25 bg-[#050505] p-3 text-sm text-[#C9A84C]">
              Saved contract: {String(uploadedPdf.name)}
              <input type="hidden" name="existing_contract_name" value={String(uploadedPdf.name)} />
              <input type="hidden" name="existing_contract_size" value={String(uploadedPdf.size ?? "")} />
              <input type="hidden" name="existing_contract_bucket" value={String(uploadedPdf.bucket ?? "")} />
              <input type="hidden" name="existing_contract_path" value={String(uploadedPdf.path ?? "")} />
              <input
                type="hidden"
                name="existing_contract_uploaded_at"
                value={String(uploadedPdf.uploaded_at ?? "")}
              />
            </div>
          ) : null}
          <input
            name="contract_pdf"
            type="file"
            accept="application/pdf"
            className="w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-sm text-[#B0A89A] file:mr-4 file:rounded-full file:border-0 file:bg-[#C8102E] file:px-4 file:py-2 file:text-xs file:font-medium file:uppercase file:tracking-[0.18em] file:text-white"
          />
          <label className="flex items-center gap-3 rounded-xl bg-[#141414] p-3 text-sm">
            <input
              type="radio"
              name="setup_path"
              value="template"
              defaultChecked={setupPath !== "upload_pdf"}
              className="h-4 w-4 accent-[#C8102E]"
            />
            Build from template
          </label>
        </fieldset>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#0B0B0B] p-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.25em] text-[#B0A89A]">
            Template rules
          </p>
          <label className="block text-sm text-[#B0A89A]">
            Payment terms
            <select
              name="payment_terms"
              defaultValue={String(template.payment_terms ?? "Net 15")}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
            >
              <option>Net 15</option>
              <option>Net 30</option>
              <option>50% upfront + 50% on delivery</option>
            </select>
          </label>
          <label className="block text-sm text-[#B0A89A]">
            Revision rounds
            <select
              name="revision_rounds"
              defaultValue={String(template.revision_rounds ?? "1")}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
            >
              <option>1</option>
              <option>2</option>
              <option>3</option>
            </select>
          </label>
          <label className="block text-sm text-[#B0A89A]">
            Exclusivity
            <select
              name="exclusivity"
              defaultValue={String(template.exclusivity ?? "Never")}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
            >
              <option>Never</option>
              <option>Sometimes</option>
              <option>Case by case</option>
            </select>
          </label>
          <label className="block text-sm text-[#B0A89A]">
            Usage rights duration
            <select
              name="usage_rights_duration"
              defaultValue={String(template.usage_rights_duration_days ?? "30")}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
            >
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </label>
          <label className="block text-sm text-[#B0A89A]">
            Governing state
            <select
              name="governing_state"
              defaultValue={String(template.governing_state ?? "Alabama")}
              className="mt-2 w-full rounded-xl border border-white/10 bg-[#141414] px-4 py-3 text-base text-[#FAFAFA] outline-none transition focus:border-[#C8102E]"
            >
              {states.map((state) => (
                <option key={state}>{state}</option>
              ))}
            </select>
          </label>
        </div>

      </WizardForm>
    </StepShell>
  );
}
