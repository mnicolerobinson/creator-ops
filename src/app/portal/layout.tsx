import type { ReactNode } from "react";
import { requireCreator } from "@/lib/auth/guards";

export default async function PortalLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireCreator();

  return (
    <div className="min-h-screen bg-[#050505] text-[#F7F0E8]">{children}</div>
  );
}
