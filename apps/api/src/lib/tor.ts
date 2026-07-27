import type { FetchLike } from "./fetch.ts";

// The Tor Project's bulk exit list: one IP per line, plain text. Downloading it
// carries NO visitor IP (it's a public list), so this outbound call is allowed
// even though per-request geo lookups are not. Refreshed at most hourly.

const TOR_LIST_URL = "https://check.torproject.org/torbulkexitlist";
const REFRESH_INTERVAL_MS = 60 * 60 * 1000;

let exits = new Set<string>();
let lastFetch = 0;
let inflight: Promise<void> | null = null;

/** True if `ip` is a known Tor exit node. Pure in-memory read (offline-safe). */
export function isTorExit(ip: string): boolean {
  return exits.has(ip);
}

/**
 * Refresh the exit set, throttled to once per hour. On failure the last good set
 * is kept. Coalesces concurrent calls onto one in-flight fetch.
 */
export function refreshTorExits(fetchImpl: FetchLike = fetch, timeoutMs = 8000): Promise<void> {
  const now = Date.now();
  if (exits.size > 0 && now - lastFetch < REFRESH_INTERVAL_MS) return Promise.resolve();
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const res = await fetchImpl(TOR_LIST_URL, { signal: AbortSignal.timeout(timeoutMs) });
      if (!res.ok) throw new Error(`tor exit list responded with ${res.status}`);
      const text = await res.text();
      const next = new Set<string>();
      for (const line of text.split("\n")) {
        const ip = line.trim();
        if (ip) next.add(ip);
      }
      if (next.size > 0) exits = next;
      lastFetch = Date.now();
    } catch (err) {
      console.warn("tor exit list refresh failed, keeping last good set:", err);
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}
