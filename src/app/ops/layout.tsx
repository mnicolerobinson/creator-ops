import Link from "next/link";
import type { ReactNode } from "react";
import { requireOps } from "@/lib/auth/guards";

export default async function OpsLayout({ children }: { children: ReactNode }) {
  await requireOps();

  return (
    <div className="min-h-screen bg-[#050505] text-[#F7F0E8]">
      <header className="border-b border-[#2A211C] bg-[#090909]/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link
              href="/ops"
              className="font-serif text-xl font-semibold tracking-wide text-[#F7F0E8]"
            >
              CreatrOps
            </Link>
            <nav className="flex gap-4 text-sm text-[#B0A89A]">
              <Link href="/ops/deals" className="hover:text-[#F7F0E8]">
                Deals
              </Link>
              <Link href="/ops/escalations" className="hover:text-[#F7F0E8]">
                Escalations
              </Link>
              <Link href="/ops/audit" className="hover:text-[#F7F0E8]">
                Audit log
              </Link>
              <Link href="/ops/metrics" className="hover:text-[#F7F0E8]">
                Metrics
              </Link>
            </nav>
          </div>
          <Link href="/portal" className="text-sm text-[#B0A89A] hover:text-[#F7F0E8]">
            Creator portal
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
