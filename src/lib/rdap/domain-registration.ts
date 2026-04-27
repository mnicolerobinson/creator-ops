/**
 * Fetch domain registration date via public RDAP (WHOIS successor).
 * Supports .com / .net via Verisign; other TLDs are attempted via rdap.org redirect when available.
 */

const VERISIGN_RDAP: Record<string, string> = {
  com: "https://rdap.verisign.com/com/v1/domain",
  net: "https://rdap.verisign.com/net/v1/domain",
};

function normalizeHost(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  try {
    const withProto = trimmed.includes("://") ? trimmed : `https://${trimmed}`;
    const host = new URL(withProto).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

export function domainForAgeCheck(args: {
  fromAddress: string | null;
  website: string | null;
}): string | null {
  const fromHost = args.fromAddress?.split("@")[1]?.toLowerCase();
  if (fromHost && !isFreeEmailHost(fromHost)) {
    return fromHost;
  }
  if (args.website) {
    return normalizeHost(args.website);
  }
  return null;
}

const FREE_LOCAL_PARTS = new Set([
  "gmail",
  "yahoo",
  "ymail",
  "hotmail",
  "outlook",
  "live",
  "icloud",
  "me",
  "msn",
  "aol",
  "proton",
  "protonmail",
  "pm",
  "gmx",
]);

export function isFreeEmailHost(host: string): boolean {
  const parts = host.split(".");
  const second = parts[parts.length - 2];
  const combined = parts.length >= 2 ? `${parts[parts.length - 2]}.${parts[parts.length - 1]}` : host;
  if (FREE_LOCAL_PARTS.has(second ?? "")) return true;
  if (combined === "yahoo.com" || combined === "yahoo.co.uk") return true;
  if (combined === "hotmail.com" || combined === "hotmail.co.uk") return true;
  if (combined === "outlook.com") return true;
  if (host === "gmail.com" || host.endsWith(".gmail.com")) return true;
  return false;
}

function tldFromDomain(domain: string): string {
  const parts = domain.split(".");
  if (parts.length < 2) return "";
  return parts[parts.length - 1]!.toLowerCase();
}

/**
 * Returns registration date or null (lookup failed / unsupported / rate limited).
 */
export async function fetchDomainRegistrationDate(domain: string): Promise<Date | null> {
  const fqdn = domain.toLowerCase().replace(/^www\./, "");
  if (!fqdn.includes(".")) return null;

  const tld = tldFromDomain(fqdn);
  const base = VERISIGN_RDAP[tld];
  const url = base ? `${base}/${encodeURIComponent(fqdn)}` : `https://rdap.org/domain/${encodeURIComponent(fqdn)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/rdap+json, application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      events?: { eventAction?: string; eventDate?: string }[];
    };
    const reg = data.events?.find(
      (e) => (e.eventAction ?? "").toLowerCase() === "registration",
    );
    if (!reg?.eventDate) return null;
    const d = new Date(reg.eventDate);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function monthsSince(date: Date): number {
  const now = new Date();
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
}
