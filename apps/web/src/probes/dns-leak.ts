import type { DnsLeakResult, DnsResolver } from "../types.ts";

interface LeakRow {
  type?: string;
  ip?: string;
  country_name?: string;
  asn?: string;
}

// The probe never throws: on any failure it returns `available: false` and the
// privacy section falls back to the DoH-reachability signal it already computes.
const unavailable = (): DnsLeakResult => ({ available: false, resolvers: [] });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Long enough for a cold start or a transient 5xx to clear, short enough to stay
// inside the scan. Retrying in the same tick, as this used to, re-hits whatever
// was failing microseconds later — a retry in name only.
const RETRY_DELAY_MS = 300;

// One retry with a short backoff smooths over the provider's occasional 5xx /
// cold-start without hanging the scan (each attempt is independently timed out).
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(RETRY_DELAY_MS);
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (res.ok) return res;
    } catch {
      // fall through to retry / give up
    }
  }
  return null;
}

// A body can fail after its headers arrived — a dropped connection mid-read
// rejects here, not at the fetch. Everything else in this probe is guarded;
// this was not, so the rejection escaped getDnsLeak and, with it, the scan.
async function readText(res: Response): Promise<string | null> {
  try {
    return (await res.text()).trim();
  } catch {
    return null;
  }
}

// DNS-leak detection uses bash.ws's unique-subdomain reflection: we resolve a
// few random subdomains so the client's real DNS resolvers announce themselves,
// then read back which resolvers answered.
//
// bash.ws is a single third-party dependency. This probe is written to degrade
// gracefully when it is slow or down (see `unavailable()` above), and tags the
// result with its `source` so the UI can name the provider honestly.
//
// FUTURE (self-hosted, Item 8): the reflection trick only needs (a) an
// authoritative nameserver we control on a delegated zone under mlz.no that logs
// the resolver IP hitting each unique label, and (b) a read-back endpoint keyed
// by that label. Implemented that way, `source` would become "mlz.no" and the
// external dependency disappears. That requires DNS/glue records + a small
// authoritative server (ops work outside this repo), so bash.ws stays the
// primary until that infrastructure exists.
export async function getDnsLeak(): Promise<DnsLeakResult> {
  const idRes = await fetchWithRetry("https://bash.ws/id", {}, 4000);
  if (!idRes) return unavailable();
  const id = await readText(idRes);
  if (!id || !/^[a-z0-9]+$/i.test(id)) return unavailable();

  // no-cors: we only need the DNS lookup to happen, not the response body.
  await Promise.all(
    Array.from({ length: 4 }, (_, i) =>
      fetch(`https://${i}.${id}.bash.ws/`, {
        mode: "no-cors",
        signal: AbortSignal.timeout(3500),
      }).catch(() => {}),
    ),
  );

  const res = await fetchWithRetry(`https://bash.ws/dnsleak/test/${id}?json`, {}, 6000);
  if (!res) return unavailable();

  let rows: LeakRow[];
  try {
    rows = (await res.json()) as LeakRow[];
  } catch {
    return unavailable();
  }
  if (!Array.isArray(rows)) return unavailable();

  const resolvers: DnsResolver[] = [];
  const seen = new Set<string>();
  let conclusion: string | undefined;
  for (const row of rows) {
    if (row.type === "dns" && row.ip && !seen.has(row.ip)) {
      seen.add(row.ip);
      resolvers.push({ ip: row.ip, country: row.country_name, asn: row.asn });
    } else if (row.type === "conclusion") {
      conclusion = row.ip;
    }
  }
  return { available: resolvers.length > 0, conclusion, resolvers, source: "bash.ws" };
}
