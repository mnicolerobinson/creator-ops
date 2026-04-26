import { StepNav, StepShell } from "../_components";

export default function OnboardingStepTwo() {
  return (
    <StepShell
      eyebrow="Step 2 of 7"
      title="Creator profile"
      body="Profile details will live here. This placeholder keeps the onboarding path moving while the full form is built."
    >
      <StepNav step={2} />
    </StepShell>
  );
}
