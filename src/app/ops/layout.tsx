import Link from "next/link";
import type { ReactNode } from "react";
import { requireOps } from "@/lib/auth/guards";

export default async function OpsLayout({ children }: { children: ReactNode }) {
  await requireOps();

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/ops" className="font-semibold text-zinc-900">
              Creator Ops
            </Link>
            <nav className="flex gap-4 text-sm text-zinc-600">
              <Link href="/ops/deals" className="hover:text-zinc-900">
                Deals
              </Link>
              <Link href="/ops/escalations" className="hover:text-zinc-900">
                Escalations
              </Link>
              <Link href="/ops/audit" className="hover:text-zinc-900">
                Audit log
              </Link>
            </nav>
          </div>
          <Link href="/portal" className="text-sm text-zinc-600 hover:text-zinc-900">
            Creator portal
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
