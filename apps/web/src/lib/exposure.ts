import type { Severity } from "../components/primitives.tsx";
import type { DnsLeakResult, EntropyEstimate, IpInfo, WebRTCResult } from "../types.ts";
import { isSuccessfulLookup } from "./format.ts";
import { foreignResolvers, ispSuggestsHosting, isVpnSignal, webrtcLeak } from "./heuristics.ts";

export interface ExposureItem {
  severity: Severity;
  label: string;
  detail?: string;
}

export interface Verdict {
  severity: Severity;
  title: string;
  sub: string;
}

export interface ExposureInput {
  d: IpInfo;
  webrtc: WebRTCResult;
  dnsLeak: DnsLeakResult;
  doh: boolean | null;
  entropy: EntropyEstimate;
}

// Derive the rail verdict + "What sites can see" ledger from a scan. Kept as a
// pure function so both the rail (verdict) and the ledger section consume it.
export function computeExposure({ d, webrtc, dnsLeak, doh, entropy }: ExposureInput): {
  verdict: Verdict;
  items: ExposureItem[];
} {
  const items: ExposureItem[] = [];
  const ok = isSuccessfulLookup(d);
  const anonymity = ok && isVpnSignal(d);
  // Real exposures a site can act on — distinct from the near-universal
  // fingerprint, which we surface but don't let dominate the verdict.
  const concerns: string[] = [];

  items.push({
    severity: ok ? "off" : "warn",
    label: ok ? "Public IP" : "IP lookup",
    detail: ok ? d.query : "failed",
  });

  if (ok) {
    const place = [d.city, d.countryCode || d.country].filter(Boolean).join(", ");
    items.push({ severity: "off", label: "Approximate location", detail: place || "unknown" });
    items.push(
      anonymity
        ? { severity: "bad", label: "VPN / proxy / Tor", detail: "detected" }
        : { severity: "ok", label: "VPN / proxy / Tor", detail: "no signal" },
    );
    if (d.hosting === true || ispSuggestsHosting(d)) {
      items.push({ severity: "warn", label: "Datacenter / cloud IP", detail: "hosting ASN" });
      concerns.push("a datacenter IP");
    }
    if (d.blocklists?.length) {
      items.push({ severity: "warn", label: "Reputation DBs", detail: d.blocklists.join(", ") });
      concerns.push("a blocklist listing");
    }
    if (d.mobile) {
      items.push({ severity: "off", label: "Mobile network", detail: "cellular ASN" });
    }
  }

  const leak = webrtcLeak(webrtc, d.query);
  items.push({
    severity: leak ? "warn" : "ok",
    label: "WebRTC leak",
    detail: leak ? "IP exposed" : "none",
  });
  if (leak) concerns.push("a WebRTC leak");

  if (dnsLeak.available) {
    const foreign = foreignResolvers(dnsLeak.resolvers, d.country);
    const n = dnsLeak.resolvers.length;
    items.push({
      severity: foreign.length ? "warn" : "ok",
      label: "DNS leak",
      detail: foreign.length
        ? foreign.length === 1
          ? `${foreign.length} foreign resolver`
          : `${foreign.length} foreign resolvers`
        : n === 1
          ? `none · ${n} resolver`
          : `none · ${n} resolvers`,
    });
    if (foreign.length) concerns.push("a DNS leak");
  } else if (doh === false) {
    items.push({ severity: "warn", label: "DNS-over-HTTPS", detail: "blocked" });
  }

  const fpHigh = entropy.bits >= 18;
  items.push({
    severity: entropy.bits >= 26 ? "bad" : fpHigh ? "warn" : "ok",
    label: "Fingerprint",
    detail: `${entropy.rarity} · ~${entropy.bits} bits`,
  });

  if (d.geo && d.geo.total > 1) {
    items.push({
      severity: "off",
      label: "Geo cross-check",
      detail: `${d.geo.agree}/${d.geo.total} agree`,
    });
  }

  const verdict: Verdict = !ok
    ? { severity: "warn", title: "Scan incomplete.", sub: "The IP lookup failed — try Refresh." }
    : anonymity
      ? {
          severity: "bad",
          title: "Anonymity signals detected.",
          sub: "This connection looks like a VPN, proxy or Tor exit.",
        }
      : concerns.length > 0
        ? {
            severity: "warn",
            title: "Some things are exposed.",
            sub: `Sites can see ${concerns.join(" and ")}.`,
          }
        : fpHigh
          ? {
              severity: "ok",
              title: "Nothing is leaking.",
              sub: "But your browser fingerprint is easy to single out.",
            }
          : {
              severity: "ok",
              title: "Nothing is leaking.",
              sub: "Your connection looks ordinary.",
            };

  return { verdict, items };
}
