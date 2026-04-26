import { StepNav, StepShell } from "../_components";

export default function OnboardingStepFive() {
  return (
    <StepShell
      eyebrow="Step 5 of 7"
      title="Contract setup"
      body="Contract setup will live here. Continue to configure the remaining onboarding steps."
    >
      <StepNav step={5} />
    </StepShell>
  );
}
