import type { DnsLeakResult, DnsResolver } from "../types.ts";

interface LeakRow {
  type?: string;
  ip?: string;
  country_name?: string;
  asn?: string;
}

const unavailable = (): DnsLeakResult => ({ available: false, resolvers: [] });

// bash.ws unique-subdomain reflection: resolve a few random subdomains so the
// client's real DNS resolvers show up, then read which resolvers answered.
export async function getDnsLeak(): Promise<DnsLeakResult> {
  try {
    const idRes = await fetch("https://bash.ws/id", { signal: AbortSignal.timeout(4000) });
    if (!idRes.ok) return unavailable();
    const id = (await idRes.text()).trim();
    if (!/^[a-z0-9]+$/i.test(id)) return unavailable();

    // no-cors: we only need the DNS lookup to happen, not the response body.
    await Promise.all(
      Array.from({ length: 4 }, (_, i) =>
        fetch(`https://${i}.${id}.bash.ws/`, {
          mode: "no-cors",
          signal: AbortSignal.timeout(3500),
        }).catch(() => {}),
      ),
    );

    const res = await fetch(`https://bash.ws/dnsleak/test/${id}?json`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return unavailable();
    const rows = (await res.json()) as LeakRow[];

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
    return { available: resolvers.length > 0, conclusion, resolvers };
  } catch {
    return unavailable();
  }
}
