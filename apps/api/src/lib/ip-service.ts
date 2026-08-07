import { IP_CACHE_MAX_ENTRIES, IP_CACHE_TTL_MS, REQUEST_TIMEOUT_MS, UPSTREAM } from "../config.ts";
import type { LocalGeo } from "../geoip/store.ts";
import { createCachedFetcher } from "./cache.ts";
import type { FetchLike } from "./fetch.ts";
import { getIpInfo, type IpInfo } from "./ip-lookup.ts";

export interface IpServiceOptions {
  geoLookup?: (ip: string) => LocalGeo | null;
  isTorExit?: (ip: string) => boolean;
  enableOnlineTiebreaker?: boolean;
  fetchImpl?: FetchLike;
  ipApiBaseUrl?: string;
  timeoutMs?: number;
  cacheTtlMs?: number;
  enrich?: (info: IpInfo) => Promise<IpInfo>;
}

export type IpService = (ip: string) => Promise<IpInfo>;

// A scan makes zero outbound requests carrying the visitor IP: geo/ASN come from
// the local GeoDb. The TtlCache + single-flight now only spare the reverse-DNS /
// DNSBL resolver calls in the enricher — there's no upstream quota to protect.
export function createIpService(options: IpServiceOptions = {}): IpService {
  const {
    geoLookup,
    isTorExit,
    enableOnlineTiebreaker,
    fetchImpl = fetch,
    ipApiBaseUrl = UPSTREAM.ipApiBaseUrl,
    timeoutMs = REQUEST_TIMEOUT_MS,
    cacheTtlMs = IP_CACHE_TTL_MS,
    enrich,
  } = options;

  const cached = createCachedFetcher<IpInfo>({
    ttlMs: cacheTtlMs,
    maxEntries: IP_CACHE_MAX_ENTRIES,
  });

  return (ip: string) =>
    cached(ip, async () => {
      const base = await getIpInfo(ip, {
        geoLookup,
        isTorExit,
        enableOnlineTiebreaker,
        fetchImpl,
        ipApiBaseUrl,
        timeoutMs,
      });
      return enrich ? enrich(base) : base;
    });
}
