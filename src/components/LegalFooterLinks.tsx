import Link from "next/link";

const linkClass =
  "text-[10px] uppercase tracking-[0.2em] text-[#6F675E] transition hover:text-[#C9A84C]";

export function LegalFooterLinks({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-[#6F675E] ${className}`.trim()}>
      <Link href="/legal/terms" className={linkClass}>
        Terms
      </Link>
      <span className="mx-3 text-[#2A211C]">|</span>
      <Link href="/legal/privacy" className={linkClass}>
        Privacy
      </Link>
    </p>
  );
}
