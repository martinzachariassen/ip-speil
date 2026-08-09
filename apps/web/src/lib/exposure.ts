import type { Severity } from "../components/primitives.tsx";
import type { DnsLeakResult, EntropyEstimate, IpInfo, WebRTCResult } from "../types.ts";
import { isSuccessfulLookup } from "./format.ts";
import type { GlossaryKey } from "./glossary.tsx";
import { foreignResolvers, ispSuggestsHosting, isVpnSignal, webrtcLeak } from "./heuristics.ts";

/**
 * Stable identity for a finding, so the readout band can pick the five it wants
 * without matching on label text — which would break the moment the wording
 * changed, and silently.
 */
export type ExposureKey =
  | "ip"
  | "location"
  | "anonymity"
  | "hosting"
  | "blocklists"
  | "mobile"
  | "webrtc"
  | "dns"
  | "doh"
  | "fingerprint"
  | "geo";

export interface ExposureItem {
  key: ExposureKey;
  severity: Severity;
  label: string;
  /** The band's label for the same finding — it has one line and five columns. */
  short?: string;
  detail?: string;
  /** Optional glossary term explained by an inline info-tip beside the label. */
  tip?: GlossaryKey;
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

// Derive the page verdict and the full ledger of findings from one scan. Pure,
// so the readout band and the verdict callout read the same computation instead
// of each deciding for itself what counts as exposed.
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
    key: "ip",
    severity: ok ? "off" : "warn",
    label: ok ? "Public IP" : "IP lookup",
    short: "Exit",
    detail: ok ? d.query : "lookup failed",
    tip: ok ? "publicIp" : undefined,
  });

  if (ok) {
    const place = [d.city, d.countryCode || d.country].filter(Boolean).join(", ");
    items.push({
      key: "location",
      severity: "off",
      label: "Approximate location",
      short: "Location",
      detail: place || "unknown",
    });
    items.push(
      anonymity
        ? {
            key: "anonymity",
            severity: "bad",
            label: "VPN / proxy / Tor",
            short: "VPN / proxy",
            detail: "detected",
            tip: "vpnProxyTor",
          }
        : {
            key: "anonymity",
            severity: "ok",
            label: "VPN / proxy / Tor",
            short: "VPN / proxy",
            detail: "none detected",
            tip: "vpnProxyTor",
          },
    );
    if (d.hosting === true || ispSuggestsHosting(d)) {
      items.push({
        key: "hosting",
        severity: "warn",
        label: "Datacenter / cloud IP",
        detail: "hosting ASN",
        tip: "datacenterIp",
      });
      concerns.push("a datacenter IP");
    }
    if (d.blocklists?.length) {
      items.push({
        key: "blocklists",
        severity: "warn",
        label: "Reputation DBs",
        detail: d.blocklists.join(", "),
        tip: "reputationDb",
      });
      concerns.push("a blocklist listing");
    }
    if (d.mobile) {
      items.push({
        key: "mobile",
        severity: "off",
        label: "Mobile network",
        detail: "cellular ASN",
      });
    }
  }

  const leak = webrtcLeak(webrtc, d.query);
  items.push({
    key: "webrtc",
    severity: leak ? "warn" : "ok",
    label: "WebRTC leak",
    short: "WebRTC",
    detail: leak ? "IP exposed" : "no leak",
    tip: "webrtcLeak",
  });
  if (leak) concerns.push("a WebRTC leak");

  if (dnsLeak.available) {
    const foreign = foreignResolvers(dnsLeak.resolvers, d.country);
    const n = dnsLeak.resolvers.length;
    items.push({
      key: "dns",
      severity: foreign.length ? "warn" : "ok",
      label: "DNS leak",
      detail: foreign.length
        ? foreign.length === 1
          ? `${foreign.length} foreign resolver`
          : `${foreign.length} foreign resolvers`
        : n === 1
          ? `none · ${n} resolver`
          : `none · ${n} resolvers`,
      tip: "dnsLeak",
    });
    if (foreign.length) concerns.push("a DNS leak");
  } else if (doh === false) {
    items.push({
      key: "doh",
      severity: "warn",
      label: "DNS-over-HTTPS",
      detail: "blocked",
      tip: "doh",
    });
  }

  const fpHigh = entropy.bits >= 18;
  items.push({
    key: "fingerprint",
    severity: entropy.bits >= 26 ? "bad" : fpHigh ? "warn" : "ok",
    label: "Fingerprint",
    short: "Fingerprint",
    detail: `~${entropy.bits} bits`,
    tip: "fingerprint",
  });

  if (d.geo && d.geo.total > 1) {
    items.push({
      key: "geo",
      severity: "off",
      label: "Geo cross-check",
      detail: `${d.geo.agree}/${d.geo.total} agree`,
      tip: "geoCrossCheck",
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

/**
 * The readings that go in the band across the top, in the order they belong
 * there — the address, where it puts you, and the three checks that most often
 * come back with something.
 *
 * It is always these five. A failed lookup produces no location and no
 * anonymity finding, and dropping the empty cells left three readings stretched
 * across the full width of the page with a column of air after each one. An
 * honest "unknown" holds the column and says why it's empty.
 */
const BAND: { key: ExposureKey; label: string; short: string }[] = [
  { key: "ip", label: "Public IP", short: "Exit" },
  { key: "location", label: "Approximate location", short: "Location" },
  { key: "anonymity", label: "VPN / proxy / Tor", short: "VPN / proxy" },
  { key: "webrtc", label: "WebRTC leak", short: "WebRTC" },
  { key: "fingerprint", label: "Fingerprint", short: "Fingerprint" },
];

export function bandItems(items: ExposureItem[]): ExposureItem[] {
  return BAND.map(
    ({ key, label, short }) =>
      items.find((item) => item.key === key) ?? {
        key,
        severity: "off" as const,
        label,
        short,
        detail: "unknown",
      },
  );
}
