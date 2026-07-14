// External network probes: IPv6 reachability and the Cloudflare trace endpoint.
import type { CFTrace } from "./types.ts";

/** Resolve the browser's public IPv6 address, or null if IPv6 is unavailable. */
export async function getIPv6(): Promise<string | null> {
  try {
    const res = await fetch("https://ipv6.icanhazip.com", {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const t = (await res.text()).trim();
    return t.includes(":") ? t : null;
  } catch {
    return null;
  }
}

/**
 * Probe Cloudflare's DNS-over-HTTPS endpoint. Returns true if reachable —
 * useful because some VPNs, captive portals and corporate DPI middleboxes
 * block DoH to keep DNS visible at the gateway.
 */
export async function getDohReachable(): Promise<boolean | null> {
  try {
    const res = await fetch("https://cloudflare-dns.com/dns-query?name=cloudflare.com&type=A", {
      signal: AbortSignal.timeout(4000),
      headers: { Accept: "application/dns-json" },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data?.Answer) && data.Answer.length > 0;
  } catch {
    return null;
  }
}

/** Fetch and parse Cloudflare's `cdn-cgi/trace` key=value report, or null. */
export async function getCFTrace(): Promise<CFTrace | null> {
  try {
    const res = await fetch("https://1.1.1.1/cdn-cgi/trace", {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const obj: CFTrace = {};
    for (const l of (await res.text()).split("\n")) {
      const i = l.indexOf("=");
      if (i > 0) obj[l.slice(0, i)] = l.slice(i + 1);
    }
    return obj;
  } catch {
    return null;
  }
}
