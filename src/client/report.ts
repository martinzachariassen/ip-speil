// Builds the copyable, redacted diagnostics report.
import { networkLabel } from "./format.ts";
import type { CFTrace, HeaderMap, IpInfo, WebRTCResult } from "./types.ts";

/** Redact an IP for sharing: keep a coarse prefix, drop the host bits. */
export function redactIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  if (ip.includes(":")) {
    const parts = ip.split(":").filter(Boolean);
    return parts.length > 2 ? `${parts.slice(0, 2).join(":")}:…` : "IPv6 redacted";
  }
  const parts = ip.split(".");
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : "IP redacted";
}

/** Assemble a redacted summary object from all collected scan data. */
export function buildReport(
  data: IpInfo,
  webrtc: WebRTCResult,
  ipv6: string | null,
  ipv6Info: IpInfo | null,
  cfTrace: CFTrace | null,
  headers: HeaderMap,
  doh: boolean | null,
) {
  return {
    generatedAt: new Date().toISOString(),
    httpIp: redactIp(data.query),
    httpNetwork: networkLabel(data) || null,
    httpCountry: data.countryCode || null,
    ipv6: redactIp(ipv6),
    ipv6Network: ipv6Info?.status === "success" ? networkLabel(ipv6Info) : null,
    ipv6Country: ipv6Info?.countryCode || null,
    signals: {
      proxy: data.proxy === true,
      vpn: data.vpn === true,
      tor: data.tor === true,
      abuser: data.abuser === true,
      hosting: data.hosting === true,
      mobile: data.mobile === true,
      dohReachable: doh,
      timezoneMismatch: !!(
        data.timezone && Intl.DateTimeFormat().resolvedOptions().timeZone !== data.timezone
      ),
      webrtcDifferentPublicIp: webrtc.pub.some((ip) => ip !== data.query),
    },
    webrtc: {
      publicCount: webrtc.pub.length,
      privateCount: webrtc.lan.length,
      relayCount: webrtc.relay.length,
      mdnsMaskedCount: webrtc.mdns,
      candidateTypes: [...new Set(webrtc.candidates.map((c) => c.type))],
    },
    cloudflare: cfTrace
      ? {
          colo: cfTrace.colo || null,
          loc: cfTrace.loc || null,
          warp: cfTrace.warp || null,
          gateway: cfTrace.gateway || null,
          http: cfTrace.http || null,
        }
      : null,
    headersObserved: Object.keys(headers ?? {}).sort(),
    note: "Redacted report: exact IP addresses and full header values are intentionally omitted.",
  };
}
