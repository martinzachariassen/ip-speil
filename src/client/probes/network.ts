import type { CFTrace } from "../types.ts";

async function fetchExitIp(url: string, wantFamily: 4 | 6): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const text = (await res.text()).trim();
    const isV6 = text.includes(":");
    if (wantFamily === 6) return isV6 ? text : null;
    return !isV6 && /^\d{1,3}(\.\d{1,3}){3}$/.test(text) ? text : null;
  } catch {
    return null;
  }
}

export const getIPv4 = () => fetchExitIp("https://ipv4.icanhazip.com", 4);
export const getIPv6 = () => fetchExitIp("https://ipv6.icanhazip.com", 6);

// Reachability, not a leak test: some VPNs, captive portals and corporate DPI
// middleboxes block DoH to keep DNS visible at the gateway.
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

export async function getCFTrace(): Promise<CFTrace | null> {
  try {
    const res = await fetch("https://1.1.1.1/cdn-cgi/trace", { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const obj: CFTrace = {};
    for (const line of (await res.text()).split("\n")) {
      const i = line.indexOf("=");
      if (i > 0) obj[line.slice(0, i)] = line.slice(i + 1);
    }
    return obj;
  } catch {
    return null;
  }
}
