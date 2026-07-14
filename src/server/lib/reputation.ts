import { promises as dns } from "node:dns";
import { isIP } from "node:net";

const DNSBLS: { name: string; zone: string }[] = [
  { name: "Spamhaus ZEN", zone: "zen.spamhaus.org" },
  { name: "Barracuda", zone: "b.barracudacentral.org" },
];

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export async function reverseDns(ip: string, timeoutMs = 2000): Promise<string | undefined> {
  if (isIP(ip) === 0) return undefined;
  const lookup = dns
    .reverse(ip)
    .then((names) => names[0])
    .catch(() => undefined);
  return withTimeout(lookup, timeoutMs, undefined);
}

// A hit resolves to 127.0.0.x; public-resolver refusal codes are 127.255.255.x
// and must not count as "listed". NXDOMAIN (not listed) throws → false.
async function isListed(host: string, timeoutMs: number): Promise<boolean> {
  const query = dns
    .resolve4(host)
    .then((addrs) => addrs.some((a) => a.startsWith("127.0.0.")))
    .catch(() => false);
  return withTimeout(query, timeoutMs, false);
}

export async function checkBlocklists(ip: string, timeoutMs = 2500): Promise<string[]> {
  if (isIP(ip) !== 4) return [];
  const reversed = ip.split(".").reverse().join(".");
  const hits = await Promise.all(
    DNSBLS.map((bl) =>
      isListed(`${reversed}.${bl.zone}`, timeoutMs).then((listed) => (listed ? bl.name : null)),
    ),
  );
  return hits.filter((name): name is string => name !== null);
}
