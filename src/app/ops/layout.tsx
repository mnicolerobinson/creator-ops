import Link from "next/link";
import type { ReactNode } from "react";
import { requireOps } from "@/lib/auth/guards";
import { OpsSignupToasts } from "./_components/ops-signup-toasts";

/** Avoid cached RSC output for auth-gated ops shell (fresh user_profiles read every request). */
export const dynamic = "force-dynamic";

const navLink = "text-xs uppercase tracking-[0.2em] text-[#8F8678] transition hover:text-[#C9A84C]";

export default async function OpsLayout({ children }: { children: ReactNode }) {
  await requireOps();

  return (
    <div className="min-h-screen bg-[#050505] text-[#F7F0E8]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(200,16,46,0.12),transparent),radial-gradient(ellipse_50%_40%_at_100%_0%,rgba(201,168,76,0.08),transparent)]" />
      <header className="relative z-10 border-b border-[#2A211C] bg-[#080808]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="flex flex-1 flex-wrap items-center gap-6">
            <Link href="/ops" className="shrink-0">
              <p className="font-[var(--font-bebas)] text-2xl tracking-[0.2em] text-[#F7F0E8]">
                Creatr<span className="text-[#C8102E]">Ops</span>
              </p>
              <p className="text-[9px] uppercase tracking-[0.4em] text-[#C9A84C]">Internal console</p>
            </Link>
            <nav className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:gap-5">
              <Link href="/ops" className={navLink}>
                Home
              </Link>
              <Link href="/ops/clients" className={navLink}>
                Clients
              </Link>
              <Link href="/ops/deals" className={navLink}>
                Deal queue
              </Link>
              <Link href="/ops/escalations" className={navLink}>
                Escalations
              </Link>
              <Link href="/ops/approvals" className={navLink}>
                Approvals
              </Link>
              <Link href="/ops/audit" className={navLink}>
                Audit
              </Link>
              <Link href="/ops/metrics" className={navLink}>
                Metrics
              </Link>
            </nav>
          </div>
          <Link
            href="/dashboard"
            className="shrink-0 text-xs uppercase tracking-[0.2em] text-[#6F675E] transition hover:text-[#F7F0E8]"
          >
            Creator view
          </Link>
        </div>
      </header>
      <main className="relative z-10 mx-auto max-w-7xl px-5 py-8 sm:px-6">{children}</main>
      <OpsSignupToasts />
    </div>
  );
}
