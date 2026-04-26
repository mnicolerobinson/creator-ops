import Link from "next/link";
import { StepShell } from "../_components";
import { ResendMagicLink } from "./resend-magic-link";

export default function OnboardingStepSeven() {
  return (
    <StepShell
      eyebrow="Step 7 of 7"
      title="You are live"
      body="You're all set! Check your email for your secure sign-in link to access your dashboard."
    >
      <ResendMagicLink />
      <div className="pt-2 text-sm text-[#B0A89A]">
        <Link href="/onboarding/step-6">Back</Link>
      </div>
    </StepShell>
  );
}
