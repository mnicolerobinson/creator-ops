import Link from "next/link";

export function StepShell({
  eyebrow,
  title,
  body,
  children,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] uppercase tracking-[0.35em] text-[#C9A84C]">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-[var(--font-cormorant)] text-5xl font-light leading-none tracking-[-0.03em]">
          {title}
        </h1>
        {body ? (
          <p className="mt-5 text-sm leading-8 text-[#B0A89A]">{body}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function StepNav({
  step,
  nextLabel = "Next",
  nextHref,
}: {
  step: number;
  nextLabel?: string;
  nextHref?: string;
}) {
  return (
    <div className="flex flex-col gap-3 pt-4">
      <Link
        href={nextHref ?? `/onboarding/step-${Math.min(step + 1, 7)}`}
        className="rounded-full bg-[#C8102E] px-5 py-3 text-center text-[11px] font-medium uppercase tracking-[0.25em] text-white transition hover:bg-[#8B0000]"
      >
        {nextLabel}
      </Link>
      <div className="flex items-center justify-between text-sm text-[#B0A89A]">
        <Link href={`/onboarding/step-${Math.max(step - 1, 1)}`}>Back</Link>
        <Link href="/dashboard">Save and continue later</Link>
      </div>
    </div>
  );
}
