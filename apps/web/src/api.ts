import type { HeaderMap, IpInfo } from "./types.ts";

// Every probe on this page times out; the two same-origin calls have to as well,
// or a Worker that accepts the connection and never answers leaves the scan
// waiting forever.
const REQUEST_TIMEOUT_MS = 8000;

/**
 * Why a lookup produced no data. A diagnostics page owes the reader the
 * difference between "you are being throttled", "the service broke" and "we
 * never reached it" — all three used to render as "the IP lookup failed".
 */
export type ScanError = "rate_limited" | "unavailable" | "unreachable";

export interface InfoResult {
  info: IpInfo;
  error: ScanError | null;
}

export async function fetchInfo(ip?: string): Promise<InfoResult> {
  const url = ip ? `/api/info?ip=${encodeURIComponent(ip)}` : "/api/info";
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (r.status === 429) return { info: {}, error: "rate_limited" };
    if (!r.ok) return { info: {}, error: "unavailable" };
    return { info: (await r.json()) as IpInfo, error: null };
  } catch {
    return { info: {}, error: "unreachable" };
  }
}

export async function fetchHeaders(): Promise<HeaderMap> {
  try {
    const r = await fetch("/api/headers", { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!r.ok) return {};
    return (await r.json()) as HeaderMap;
  } catch {
    return {};
  }
}
