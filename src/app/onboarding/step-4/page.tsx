import { StepNav, StepShell } from "../_components";

export default function OnboardingStepFour() {
  return (
    <StepShell
      eyebrow="Step 4 of 7"
      title="Brand preferences"
      body="Brand preference controls will live here. This scaffold keeps the mobile-first flow in place."
    >
      <StepNav step={4} />
    </StepShell>
  );
}
