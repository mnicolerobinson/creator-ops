"use client";

import { usePathname } from "next/navigation";
import { LegalFooterLinks } from "@/components/LegalFooterLinks";

function getStep(pathname: string) {
  const match = pathname.match(/\/onboarding\/step-(\d+)/);
  return match ? Number(match[1]) : 1;
}

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const step = Math.min(Math.max(getStep(usePathname()), 1), 7);

  return (
    <main className="min-h-screen bg-[#050505] px-5 py-8 text-[#FAFAFA]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(200,16,46,0.2),transparent_34%),radial-gradient(circle_at_bottom,rgba(201,168,76,0.16),transparent_38%)]" />
      <div className="relative mx-auto max-w-xl">
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="font-[var(--font-bebas)] text-3xl tracking-[0.18em]">
              <span>Creatr</span>
              <span className="text-[#C8102E]">Ops</span>
            </p>
            <p className="mt-1 text-[9px] uppercase tracking-[0.45em] text-[#C9A84C]">
              by Clairen Haus
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.25em] text-[#B0A89A]">
            {step}/7
          </span>
        </header>

        <div className="mt-8 h-1 rounded-full bg-white/10">
          <div
            className="h-1 rounded-full bg-[#C8102E]"
            style={{ width: `${(step / 7) * 100}%` }}
          />
        </div>

        <section className="mt-10">{children}</section>
        <LegalFooterLinks className="mt-12 pb-4" />
      </div>
    </main>
  );
}
