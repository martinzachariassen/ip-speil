import { dnssecVerdict } from "../lib/heuristics.ts";
import type { DnssecResult } from "../types.ts";

// A domain is "reachable" if a no-cors fetch to it resolves at all. We never read
// the (opaque) response — success means DNS resolved and the TLS handshake
// completed; any HTTP status counts. A rejection means the name did not resolve
// (SERVFAIL) or the connection failed.
async function reachable(url: string): Promise<boolean> {
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store", signal: AbortSignal.timeout(4000) });
    return true;
  } catch {
    return false;
  }
}

// Detect whether the visitor's DNS resolver validates DNSSEC.
//
// `brokendnssec.net` (operated by Cloudflare) carries a deliberately invalid
// DNSSEC signature: a *validating* resolver returns SERVFAIL, so the fetch
// fails; a non-validating resolver hands back the address and the fetch succeeds.
// `dnssec.works` is correctly signed and always reachable — it's the control that
// tells a genuine network failure apart from DNSSEC-driven blocking.
//
// Both origins are added to the page CSP `connect-src` in apps/web/public/_headers.
export async function getDnssec(): Promise<DnssecResult> {
  const [controlReachable, brokenReachable] = await Promise.all([
    reachable("https://dnssec.works/"),
    reachable("https://www.brokendnssec.net/"),
  ]);
  return {
    validates: dnssecVerdict(controlReachable, brokenReachable),
    controlReachable,
    brokenReachable,
  };
}
