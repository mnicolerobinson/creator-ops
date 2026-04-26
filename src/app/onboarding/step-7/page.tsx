import { StepNav, StepShell } from "../_components";

export default function OnboardingStepSeven() {
  return (
    <StepShell
      eyebrow="Step 7 of 7"
      title="You are live"
      body="Your referral code and account manager details will appear here. Complete setup to enter your dashboard."
    >
      <StepNav step={7} nextHref="/dashboard" nextLabel="Go to dashboard" />
    </StepShell>
  );
}
