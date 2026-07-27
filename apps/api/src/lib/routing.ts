import { isIP } from "node:net";

import type { RoutingInfo, RpkiInfo, RpkiRoa } from "@ip-speil/shared";

import { RIPESTAT, ROUTING_CACHE_MAX_ENTRIES, ROUTING_CACHE_TTL_MS } from "../config.ts";
import { ipv6ToBigInt } from "../geoip/parse.ts";
import { createCachedFetcher } from "./cache.ts";
import { type FetchLike, fetchJson } from "./fetch.ts";

// Zero the host bits of an IP so only a whole network block is ever sent to
// RIPEstat. Returns e.g. "203.0.113.0/24" or "2001:db8:1::/48", or null for a
// non-IP. `v4Bits`/`v6Bits` are assumed to be multiples of 8/16 respectively.
export function networkBlock(ip: string, v4Bits = 24, v6Bits = 48): string | null {
  const version = isIP(ip);
  if (version === 4) {
    const octets = ip.split(".").map(Number);
    if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
      return null;
    }
    const keep = Math.floor(v4Bits / 8);
    const zeroed = octets.map((o, i) => (i < keep ? o : 0));
    return `${zeroed.join(".")}/${v4Bits}`;
  }
  if (version === 6) {
    try {
      const n = ipv6ToBigInt(ip);
      const groups = Math.floor(v6Bits / 16);
      const top = n >> BigInt(128 - groups * 16);
      const parts: string[] = [];
      for (let i = groups - 1; i >= 0; i--) {
        parts.push(((top >> BigInt(i * 16)) & 0xffffn).toString(16));
      }
      return `${parts.join(":")}::/${v6Bits}`;
    } catch {
      return null;
    }
  }
  return null;
}

interface NetworkInfoResp {
  data?: { prefix?: string; asns?: string[] };
}

interface RpkiResp {
  data?: {
    status?: string;
    validating_roas?: {
      origin?: string;
      prefix?: string;
      max_length?: number;
      validity?: string;
    }[];
  };
}

interface AbuseResp {
  data?: { abuse_contacts?: string[] };
}

const RPKI_STATES = new Set(["valid", "invalid", "unknown"]);

// Normalise a RIPEstat rpki-validation response. Anything other than the three
// known states collapses to "unknown" so the UI never invents a verdict.
export function normaliseRpki(resp: RpkiResp): RpkiInfo {
  const raw = resp.data?.status?.toLowerCase();
  const state = (raw && RPKI_STATES.has(raw) ? raw : "unknown") as RpkiInfo["state"];
  const roas: RpkiRoa[] = (resp.data?.validating_roas ?? [])
    .filter((r) => r.origin || r.prefix)
    .map((r) => ({
      origin: r.origin ? `AS${r.origin}` : "",
      prefix: r.prefix ?? "",
      maxLength: r.max_length,
      validity: r.validity,
    }));
  return roas.length ? { state, roas } : { state };
}

export interface RoutingLookupOptions {
  fetchImpl?: FetchLike;
  baseUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  ipv4PrefixBits?: number;
  ipv6PrefixBits?: number;
}

export type RoutingLookup = (ip: string) => Promise<RoutingInfo | undefined>;

/**
 * Build a routing/RPKI/abuse lookup backed by RIPEstat. Chains network-info
 * (prefix + origin ASN) into rpki-validation and abuse-contact-finder, and
 * caches by network block — so thousands of visitors on one prefix share a
 * single upstream lookup. Every failure degrades to `undefined`; it never throws
 * and never blocks the scan beyond its per-call timeout.
 */
export function createRoutingLookup(options: RoutingLookupOptions = {}): RoutingLookup {
  const {
    fetchImpl = fetch,
    baseUrl = RIPESTAT.baseUrl,
    timeoutMs = RIPESTAT.timeoutMs,
    cacheTtlMs = ROUTING_CACHE_TTL_MS,
    ipv4PrefixBits = RIPESTAT.ipv4PrefixBits,
    ipv6PrefixBits = RIPESTAT.ipv6PrefixBits,
  } = options;

  const cached = createCachedFetcher<RoutingInfo | undefined>({
    ttlMs: cacheTtlMs,
    maxEntries: ROUTING_CACHE_MAX_ENTRIES,
  });

  const call = <T>(path: string) => fetchJson<T>(fetchImpl, `${baseUrl}/${path}`, timeoutMs);
  const q = encodeURIComponent;

  const fetchRouting = async (resource: string): Promise<RoutingInfo | undefined> => {
    const ni = await call<NetworkInfoResp>(`network-info/data.json?resource=${q(resource)}`);
    const prefix = ni.data?.prefix;
    const asn = ni.data?.asns?.[0];
    if (!prefix && !asn) return { queried: resource };

    const [rpki, abuseContacts] = await Promise.all([
      prefix && asn
        ? call<RpkiResp>(`rpki-validation/data.json?resource=${q(asn)}&prefix=${q(prefix)}`)
            .then(normaliseRpki)
            .catch(() => undefined)
        : Promise.resolve(undefined),
      call<AbuseResp>(`abuse-contact-finder/data.json?resource=${q(resource)}`)
        .then((r) => r.data?.abuse_contacts?.filter(Boolean))
        .catch(() => undefined),
    ]);

    return {
      prefix,
      originAsn: asn ? `AS${asn}` : undefined,
      rpki,
      abuseContacts: abuseContacts?.length ? abuseContacts : undefined,
      queried: resource,
    };
  };

  return (ip) => {
    const resource = networkBlock(ip, ipv4PrefixBits, ipv6PrefixBits);
    if (!resource) return Promise.resolve(undefined);
    // Cache keyed by network block; a thrown/timed-out lookup degrades to
    // undefined (and, being undefined, is retried rather than cached).
    return cached(resource, () => fetchRouting(resource).catch(() => undefined));
  };
}
