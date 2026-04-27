import Link from "next/link";
import { StepShell } from "../_components";

export default function OnboardingStepSeven() {
  return (
    <StepShell
      eyebrow="Step 7 of 7"
      title="You are live"
      body="You're all set! Sign in with your email and password to access your dashboard."
    >
      <div className="pt-2 text-sm text-[#B0A89A]">
        <Link href="/onboarding/step-6">Back</Link>
      </div>
    </StepShell>
  );
}
