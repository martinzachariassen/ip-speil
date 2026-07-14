import { byId } from "../lib/dom.ts";
import { esc, isSuccessfulLookup } from "../lib/format.ts";
import { ispSuggestsHosting, isVpnSignal, webrtcLeak } from "../lib/heuristics.ts";
import type { DnsLeakResult, EntropyEstimate, IpInfo, WebRTCResult } from "../types.ts";

type Severity = "ok" | "warn" | "bad" | "off";

export interface ExposureItem {
  severity: Severity;
  label: string;
  detail?: string;
}

interface ExposureInput {
  d: IpInfo;
  webrtc: WebRTCResult;
  dnsLeak: DnsLeakResult;
  doh: boolean | null;
  entropy: EntropyEstimate;
}

export function computeExposure({ d, webrtc, dnsLeak, doh, entropy }: ExposureInput): {
  headline: string;
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
    label: ok ? "Public IP visible" : "IP lookup failed",
    detail: ok ? d.query : undefined,
  });

  if (ok) {
    const place = [d.city, d.country].filter(Boolean).join(", ");
    items.push({ severity: "off", label: "Approximate location", detail: place || "unknown" });
    items.push(
      anonymity
        ? { severity: "bad", label: "VPN / proxy / Tor detected" }
        : { severity: "ok", label: "No VPN / proxy signal" },
    );
    if (d.hosting === true || ispSuggestsHosting(d)) {
      items.push({ severity: "warn", label: "Datacenter / cloud IP" });
      concerns.push("hosting");
    }
    if (d.blocklists?.length) {
      items.push({
        severity: "warn",
        label: "Listed in reputation DBs",
        detail: d.blocklists.join(", "),
      });
      concerns.push("reputation");
    }
  }

  const leak = webrtcLeak(webrtc, d.query);
  items.push({ severity: leak ? "warn" : "ok", label: leak ? "WebRTC IP leak" : "No WebRTC leak" });
  if (leak) concerns.push("webrtc");

  if (dnsLeak.available) {
    const foreign = dnsLeak.resolvers.filter(
      (r) => r.country && d.country && r.country !== d.country,
    );
    items.push({
      severity: foreign.length ? "warn" : "ok",
      label: foreign.length ? "Possible DNS leak" : "No DNS leak",
    });
    if (foreign.length) concerns.push("dns");
  } else if (doh === false) {
    items.push({ severity: "warn", label: "DNS-over-HTTPS blocked" });
  }

  const fpHigh = entropy.bits >= 18;
  items.push({
    severity: entropy.bits >= 26 ? "bad" : fpHigh ? "warn" : "ok",
    label: `Fingerprint: ${entropy.rarity}`,
    detail: `~${entropy.bits} bits`,
  });

  if (d.geo && d.geo.total > 1) {
    items.push({ severity: "off", label: `Geo: ${d.geo.agree}/${d.geo.total} sources agree` });
  }

  const headline = !ok
    ? "Couldn't complete the scan — try Refresh"
    : anonymity
      ? "Anonymity signals detected — likely a VPN, proxy or Tor"
      : concerns.length > 0
        ? "Some things are exposed to the sites you visit"
        : fpHigh
          ? "Your connection is ordinary, but your browser is easy to fingerprint"
          : "Your connection looks fairly ordinary";

  return { headline, items };
}

export function renderExposure(input: ExposureInput) {
  const { headline, items } = computeExposure(input);
  byId("exposure-headline").textContent = headline;
  byId("exposure-grid").innerHTML = items
    .map(
      (i) =>
        `<div class="chip"><span class="dot ${i.severity}"></span><span class="chip-l">${esc(i.label)}</span>${
          i.detail ? `<span class="chip-d">${esc(i.detail)}</span>` : ""
        }</div>`,
    )
    .join("");
}
