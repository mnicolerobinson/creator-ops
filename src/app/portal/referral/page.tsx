import Link from "next/link";
import QRCode from "qrcode";
import { getReferralDashboardData, type ReferralTableRow } from "@/lib/referral/data";
import { requireCreator } from "@/lib/auth/guards";
import { ReferralQrClient } from "./referral-qr-client";

export const dynamic = "force-dynamic";

function money(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ReferralTable({
  rows,
  showReferredBy,
}: {
  rows: ReferralTableRow[];
  showReferredBy?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[#8F8678]">No entries yet.</p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#2A211C] text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
            <th className="py-3 pr-4">Creator</th>
            <th className="py-3 pr-4">Plan</th>
            <th className="py-3 pr-4">Status</th>
            <th className="py-3 pr-4">Joined</th>
            {showReferredBy ? <th className="py-3 pr-4">Referred by</th> : null}
            <th className="py-3 pr-4 text-right">This month</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#1D1713] text-[#F7F0E8]">
          {rows.map((r) => (
            <tr key={r.userId}>
              <td className="py-4 pr-4 font-medium">{r.displayName}</td>
              <td className="py-4 pr-4 text-[#B0A89A]">{r.planTier}</td>
              <td className="py-4 pr-4">
                <span
                  className={`rounded-full border px-3 py-1 text-xs ${
                    r.isActive
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-zinc-600/50 bg-zinc-800/40 text-zinc-400"
                  }`}
                >
                  {r.isActive ? "Active" : "Inactive"}
                </span>
              </td>
              <td className="py-4 pr-4 text-[#8F8678]">{dateLabel(r.dateJoined)}</td>
              {showReferredBy ? (
                <td className="py-4 pr-4 text-[#B0A89A]">
                  {r.referredByDisplayName ?? "—"}
                </td>
              ) : null}
              <td className="py-4 text-right text-[#C9A84C]">
                {money(r.monthlyCommissionCents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function ReferralPage() {
  const { user } = await requireCreator();
  if (!user) {
    return null;
  }

  const data = await getReferralDashboardData(user.id);
  const qrUrl = `https://creatrops.com?ref=${encodeURIComponent(data.code)}`;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, {
    width: 480,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0a0a", light: "#FAFAFA" },
  });
  const isFounding = data.affiliateTier === "founding";

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/dashboard"
          className="text-xs uppercase tracking-[0.2em] text-[#8F8678] transition hover:text-[#C9A84C]"
        >
          ← Dashboard
        </Link>
        <p className="text-[10px] uppercase tracking-[0.3em] text-[#6F675E]">
          Month {data.monthKey}
        </p>
      </div>

      <h1
        className="font-[family-name:var(--font-cormorant)] text-4xl font-light text-[#F7F0E8] md:text-5xl"
        style={{ fontFamily: "var(--font-cormorant), serif" }}
      >
        Referral studio
      </h1>
      <p className="mt-2 text-sm text-[#B0A89A]">
        Share your link. Earn when creators you refer subscribe — no email addresses shown here, ever.
      </p>

      <div className="mt-10 rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-6">
        <ReferralQrClient referralCode={data.code} qrDataUrl={qrDataUrl} />
      </div>

      <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isFounding ? (
          <>
            <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
                Tier 1 earnings
              </p>
              <p className="mt-3 font-[family-name:var(--font-bebas)] text-3xl tracking-wider text-[#C9A84C]">
                {money(data.tier1MonthlyCents)}
              </p>
            </div>
            <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
                Tier 2 earnings
              </p>
              <p className="mt-3 font-[family-name:var(--font-bebas)] text-3xl tracking-wider text-[#C9A84C]">
                {money(data.tier2MonthlyCents)}
              </p>
            </div>
            <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5 md:col-span-2 lg:col-span-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
                Combined total
              </p>
              <p className="mt-3 font-[family-name:var(--font-bebas)] text-3xl tracking-wider text-[#C9A84C]">
                {money(data.totalMonthlyCents)}
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
                Total referred
              </p>
              <p className="mt-3 font-[family-name:var(--font-bebas)] text-3xl tracking-wider text-[#C9A84C]">
                {data.totalReferred}
              </p>
            </div>
            <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">Active</p>
              <p className="mt-3 font-[family-name:var(--font-bebas)] text-3xl tracking-wider text-[#C9A84C]">
                {data.activeCount}
              </p>
            </div>
            <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-5">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#6F675E]">
                Monthly commission
              </p>
              <p className="mt-3 font-[family-name:var(--font-bebas)] text-3xl tracking-wider text-[#C9A84C]">
                {money(data.totalMonthlyCents)}
              </p>
            </div>
          </>
        )}
      </div>

      <section className="mt-12 space-y-4">
        <h2
          className="font-[family-name:var(--font-cormorant)] text-2xl text-[#F7F0E8]"
          style={{ fontFamily: "var(--font-cormorant), serif" }}
        >
          {isFounding ? "Your direct referrals" : "Your referrals"}
        </h2>
        <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-4">
          <ReferralTable rows={data.directRows} />
        </div>
      </section>

      {isFounding ? (
        <section className="mt-10 space-y-4">
          <h2
            className="font-[family-name:var(--font-cormorant)] text-2xl text-[#F7F0E8]"
            style={{ fontFamily: "var(--font-cormorant), serif" }}
          >
            Their referrals
          </h2>
          <p className="text-sm text-[#8F8678]">Second-level referrals (founding program).</p>
          <div className="rounded-3xl border border-[#2A211C] bg-[#0B0B0B] p-4">
            <ReferralTable rows={data.tier2Rows} showReferredBy />
          </div>
        </section>
      ) : null}
    </main>
  );
}
