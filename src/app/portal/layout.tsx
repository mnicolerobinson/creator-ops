import Link from "next/link";
import type { ReactNode } from "react";
import { requireCreator } from "@/lib/auth/guards";

export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCreator();

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/portal" className="font-semibold text-zinc-900">
              Your operations
            </Link>
            <nav className="flex gap-4 text-sm text-zinc-600">
              <Link href="/portal/deals" className="hover:text-zinc-900">
                Deals
              </Link>
            </nav>
          </div>
          <Link href="/ops" className="text-sm text-zinc-500 hover:text-zinc-800">
            Staff
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
