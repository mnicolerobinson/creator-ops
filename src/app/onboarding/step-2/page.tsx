import { CreatorProfileForm } from "./creator-profile-form";
import { StepShell } from "../_components";

export default function OnboardingStepTwo() {
  return (
    <StepShell
      eyebrow="Step 2 of 7"
      title="Creator profile"
      body="Tell your ops team how brands should see you and where your audience lives."
    >
      <CreatorProfileForm />
    </StepShell>
  );
}
