import {
  domainForAgeCheck,
  fetchDomainRegistrationDate,
  isFreeEmailHost,
  monthsSince,
} from "@/lib/rdap/domain-registration";

const SCAM_PHRASES = [
  "send you a check",
  "purchase equipment",
  "wire transfer upfront",
  "western union",
  "gift card",
] as const;

const BUDGET_SUSPICIOUS_USD = 50_000;

export type ExtractionForSafety = {
  brandName: string | null;
  website: string | null;
  budget: { amount: number | null; currency: string | null } | null;
};

function hasScamPhrases(textLower: string): string | null {
  for (const phrase of SCAM_PHRASES) {
    if (textLower.includes(phrase)) return phrase;
  }
  return null;
}

function hasUrlInText(text: string) {
  return /https?:\/\/[^\s<>"')]+/i.test(text) || /\bwww\.[a-z0-9.-]+\.[a-z]{2,}\b/i.test(text);
}

function hasCompanyMentionLine(text: string) {
  return /(?:^|\n).{0,120}(?:company|brand|client)\s*[:#-]\s*\S+/i.test(text);
}

/**
 * Inbound safety checks for brand-deal email. Returns flag codes; any flag triggers escalation.
 */
export async function evaluateIntakeSafety(args: {
  fullText: string;
  fromAddress: string | null;
  extraction: ExtractionForSafety;
}): Promise<{ flags: string[]; shouldEscalate: boolean; domainAgeNote: string | null }> {
  const flags: string[] = [];
  const { fullText, fromAddress, extraction } = args;
  const lower = fullText.toLowerCase();
  const fromHost = fromAddress?.split("@")[1]?.toLowerCase() ?? null;

  const phrase = hasScamPhrases(lower);
  if (phrase) flags.push(`scam_phrase:${phrase}`);

  const amount = extraction.budget?.amount;
  if (amount != null && Number.isFinite(amount) && amount > BUDGET_SUSPICIOUS_USD) {
    flags.push("budget_over_50k");
  }

  const brand = extraction.brandName?.trim();
  const website = extraction.website?.trim();
  if (!brand && !website && !hasUrlInText(fullText) && !hasCompanyMentionLine(fullText)) {
    flags.push("no_company_or_website");
  }

  if (fromHost && isFreeEmailHost(fromHost) && brand && brand.length >= 2) {
    flags.push("free_email_brand_claim");
  }

  let domainAgeNote: string | null = null;
  const domain = domainForAgeCheck({ fromAddress, website: website ?? null });
  if (domain) {
    const reg = await fetchDomainRegistrationDate(domain);
    if (reg) {
      const m = monthsSince(reg);
      if (m < 6) {
        flags.push("domain_age_under_6mo");
        domainAgeNote = `${domain} registered ${reg.toISOString().slice(0, 10)}`;
      }
    }
  }

  return { flags, shouldEscalate: flags.length > 0, domainAgeNote };
}
