"use client";

import { useRouter } from "next/navigation";

type Deal = {
  id: string;
  title: string;
  stage: string;
  campaign_type: string | null;
  quoted_amount_cents: number | null;
  due_date: string | null;
  updated_at: string | null;
  company_id: string | null;
  assigned_persona_id: string | null;
};

function formatCurrency(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function StagePill({ stage }: { stage: string }) {
  const color =
    stage === "completed" || stage === "paid"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : stage === "declined" || stage === "lost"
        ? "border-zinc-500/30 bg-zinc-700/30 text-zinc-300"
        : "border-[#C8102E]/40 bg-[#C8102E]/15 text-[#FFCED6]";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs capitalize ${color}`}>
      {stage.replace(/_/g, " ")}
    </span>
  );
}

export function PortalDealRows({
  deals,
  companiesById,
  personasById,
}: {
  deals: Deal[];
  companiesById: Record<string, string>;
  personasById: Record<string, string>;
}) {
  const router = useRouter();

  return (
    <>
      {deals.map((deal) => {
        const brand =
          (deal.company_id ? companiesById[deal.company_id] : null) ?? deal.title;
        return (
          <tr
            key={deal.id}
            role="link"
            tabIndex={0}
            className="cursor-pointer border-b border-[#1D1713] transition-colors hover:bg-[#12100E] last:border-0"
            onClick={() => router.push(`/portal/deals/${deal.id}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                router.push(`/portal/deals/${deal.id}`);
              }
            }}
          >
            <td className="py-4 pr-4">
              <span className="text-[#F7F0E8]">{brand}</span>
              <p className="mt-1 text-xs text-[#6F675E]">
                {deal.assigned_persona_id
                  ? personasById[deal.assigned_persona_id] ?? "Assigned"
                  : "Review queue"}
              </p>
            </td>
            <td className="py-4 pr-4 text-[#B0A89A]">
              {deal.campaign_type ?? "Not set"}
            </td>
            <td className="py-4 pr-4 text-[#C9A84C]">
              {formatCurrency(deal.quoted_amount_cents ?? 0)}
            </td>
            <td className="py-4 pr-4">
              <StagePill stage={deal.stage} />
            </td>
            <td className="py-4 pr-4 text-[#8F8678]">
              {deal.updated_at
                ? new Date(deal.updated_at).toLocaleDateString()
                : "Pending"}
            </td>
            <td className="py-4 text-[#8F8678]">
              {deal.due_date
                ? new Date(`${deal.due_date}T12:00:00`).toLocaleDateString()
                : "—"}
            </td>
          </tr>
        );
      })}
    </>
  );
}
