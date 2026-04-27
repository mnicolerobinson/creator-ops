import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL_VERSION, TERMS_MARKDOWN } from "@/lib/legal/creatrops-legal-content";
import { LegalProse } from "@/lib/legal/LegalProse";

export const metadata: Metadata = {
  title: "Terms of Service | CreatrOps",
  description: "CreatrOps Terms of Service",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-[#050505] px-5 py-12 text-[#FAFAFA]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(201,168,76,0.12),transparent_50%),radial-gradient(ellipse_at_80%_100%,rgba(200,16,46,0.1),transparent_45%)]" />
      <div className="relative mx-auto max-w-3xl">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#C9A84C]">
          Legal · Version {LEGAL_VERSION}
        </p>
        <h1 className="mt-4 font-[var(--font-cormorant)] text-4xl font-light tracking-tight text-[#F7F0E8] md:text-5xl">
          Terms of Service
        </h1>
        <div className="my-10 h-px w-24 bg-gradient-to-r from-[#C9A84C]/60 to-transparent" />
        <LegalProse markdown={TERMS_MARKDOWN} />
        <p className="mt-12 border-t border-[#C9A84C]/20 pt-8 text-sm text-[#6F675E]">
          Last updated: CreatrOps legal framework {LEGAL_VERSION}. For questions, contact
          ops@clairenhaus.com
        </p>
        <p className="mt-6 text-center text-sm text-[#8F8678]">
          <Link href="/legal/privacy" className="text-[#C9A84C] underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
        </p>
        <p className="mt-4 text-center">
          <Link
            href="/login"
            className="text-xs uppercase tracking-[0.2em] text-[#6F675E] hover:text-[#C9A84C]"
          >
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
