import { StepNav, StepShell } from "../_components";

export default function OnboardingStepThree() {
  return (
    <StepShell
      eyebrow="Step 3 of 7"
      title="Rate card"
      body="Rate card inputs will live here. For now, continue through the setup flow."
    >
      <StepNav step={3} />
    </StepShell>
  );
}
