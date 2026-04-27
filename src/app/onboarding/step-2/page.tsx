import { CreatorProfileForm } from "./creator-profile-form";
import { StepShell } from "../_components";
import { getOnboardingData } from "../data";

function asRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

export default async function OnboardingStepTwo() {
  const { client, policy } = await getOnboardingData();
  const creatorProfile = asRecord(policy.creator_profile);
  const followerRanges = asRecord(creatorProfile.follower_count_range_per_platform);
  const primaryPlatforms = Array.isArray(creatorProfile.primary_platforms)
    ? creatorProfile.primary_platforms.map(String)
    : [];

  return (
    <StepShell
      eyebrow="Step 2 of 7"
      title="Creator profile"
      body="Tell your ops team how brands should see you and where your audience lives."
    >
      <CreatorProfileForm
        initial={{
          displayName:
            String(creatorProfile.display_name ?? client?.creator_display_name ?? ""),
          primaryNiche: String(creatorProfile.primary_niche ?? client?.niche ?? ""),
          primaryPlatforms,
          followerRanges: Object.fromEntries(
            Object.entries(followerRanges).map(([key, val]) => [key, String(val)]),
          ),
        }}
      />
    </StepShell>
  );
}
