// Wrappers around this app's own JSON endpoints.
import type { HeaderMap, IpInfo } from "./types.ts";

/**
 * Look up IP geolocation via the server. Pass an `ip` to look up a specific
 * address, or omit it to look up the caller's. Resolves to `{}` on failure.
 */
export async function fetchInfo(ip?: string): Promise<IpInfo> {
  const url = ip ? `/api/info?ip=${encodeURIComponent(ip)}` : "/api/info";
  try {
    const r = await fetch(url);
    return (await r.json()) as IpInfo;
  } catch {
    return {};
  }
}

/** Fetch the request headers the server saw. Resolves to `{}` on failure. */
export async function fetchHeaders(): Promise<HeaderMap> {
  try {
    const r = await fetch("/api/headers");
    return (await r.json()) as HeaderMap;
  } catch {
    return {};
  }
}
