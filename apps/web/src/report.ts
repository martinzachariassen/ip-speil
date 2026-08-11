import { clientHintsStatus } from "./lib/client-hints.ts";
import { networkLabel } from "./lib/format.ts";
import { foreignResolvers, webrtcLeak } from "./lib/heuristics.ts";
import type {
  DnsLeakResult,
  DnssecResult,
  EntropyEstimate,
  Exits,
  HeaderMap,
  IpInfo,
  WebRTCResult,
} from "./types.ts";

// Keep a coarse prefix, drop the host bits, so the report is shareable.
export function redactIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.length > 2 ? `${parts.slice(0, 2).join(":")}:…` : "IPv6 redacted";
  }
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : "IP redacted";
}

export interface ReportInput {
  data: IpInfo;
  webrtc: WebRTCResult;
  exits: Exits;
  ipv6Info: IpInfo | null;
  headers: HeaderMap;
  dnsLeak: DnsLeakResult;
  dnssec: DnssecResult;
  doh: boolean | null;
  entropy: EntropyEstimate;
}

// The normalised, redacted diagnostics object. Reused as the unit stored for the
// snapshot/diff feature and encoded into shareable links.
export type Report = ReturnType<typeof buildReport>;

export function buildReport(input: ReportInput) {
  const { data, webrtc, exits, ipv6Info, headers, dnsLeak, dnssec, doh, entropy } = input;
  const foreignCount = foreignResolvers(dnsLeak.resolvers, data.country).length;
  const routing = data.routing;

  return {
    generatedAt: new Date().toISOString(),
    httpIp: redactIp(data.query),
    httpNetwork: networkLabel(data) || null,
    httpCountry: data.countryCode || null,
    reverseDns: data.reverse || null,
    ipv4Exit: redactIp(exits.v4),
    ipv6: redactIp(exits.v6),
    ipv6Network: ipv6Info?.status === "success" ? networkLabel(ipv6Info) : null,
    ipv6Country: ipv6Info?.countryCode || null,
    geoAgreement: data.geo ? `${data.geo.agree}/${data.geo.total}` : null,
    routing: routing
      ? {
          prefix: routing.prefix || null,
          originAsn: routing.originAsn || null,
          rpki: routing.rpki?.state ?? null,
          abuseContacts: routing.abuseContacts ?? [],
        }
      : null,
    signals: {
      proxy: data.proxy === true,
      vpn: data.vpn === true,
      tor: data.tor === true,
      abuser: data.abuser === true,
      blocklists: data.blocklists ?? [],
      hosting: data.hosting === true,
      mobile: data.mobile === true,
      dohReachable: doh,
      dnssecValidated: dnssec.validates,
      dnsResolverCount: dnsLeak.available ? dnsLeak.resolvers.length : null,
      dnsForeignResolvers: dnsLeak.available ? foreignCount : null,
      timezoneMismatch: !!(
        data.timezone && Intl.DateTimeFormat().resolvedOptions().timeZone !== data.timezone
      ),
      webrtcDifferentPublicIp: webrtcLeak(webrtc, data.query),
      fingerprintEntropyBits: entropy.bits,
      fingerprintSignals: entropy.contributions.map((c) => c.label),
    },
    webrtc: {
      publicCount: webrtc.pub.length,
      privateCount: webrtc.lan.length,
      relayCount: webrtc.relay.length,
      mdnsMaskedCount: webrtc.mdns,
      candidateTypes: [...new Set(webrtc.candidates.map((c) => c.type))],
    },
    headersObserved: Object.keys(headers ?? {}).sort(),
    // Presence/absence of the high-entropy client hints we solicited — never
    // their values, to keep the report shareable.
    clientHints: clientHintsStatus(headers ?? {}).map((h) => ({
      header: h.header,
      answered: h.value !== null,
    })),
    note: "Redacted report: exact IPs and full header values are omitted. Browser fingerprint details stay local — only a coarse entropy estimate is included.",
  };
}
