import { StepNav, StepShell } from "../_components";

export default function OnboardingStepSix() {
  return (
    <StepShell
      eyebrow="Step 6 of 7"
      title="Inbox setup"
      body="Inbox forwarding instructions will live here. Continue when you are ready to activate."
    >
      <StepNav step={6} />
    </StepShell>
  );
}
