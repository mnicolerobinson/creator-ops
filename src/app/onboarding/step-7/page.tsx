import Link from "next/link";
import { StepShell } from "../_components";

export default function OnboardingStepSeven() {
  return (
    <StepShell
      eyebrow="Step 7 of 7"
      title="You're live."
      body="Check your email for your login credentials. Your dedicated ops team is already working in the background."
    >
      <div className="space-y-5 rounded-3xl border border-[#C9A84C]/25 bg-[#0B0B0B] p-5 shadow-2xl shadow-black/30">
        <p className="text-sm leading-7 text-[#C9A84C]">
          Sarah Chen, Partnerships Lead is now managing your brand partnerships
        </p>
        <Link
          href="/login"
          className="block rounded-full bg-[#C8102E] px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-white transition hover:bg-[#8B0000]"
        >
          Sign In to Your Dashboard
        </Link>
      </div>
    </StepShell>
  );
}
