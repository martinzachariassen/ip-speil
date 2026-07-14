import {
  IP_CACHE_MAX_ENTRIES,
  IP_CACHE_TTL_MS,
  IPAPI_DAILY_BUDGET,
  REQUEST_TIMEOUT_MS,
  UPSTREAM,
} from "../config.ts";
import { createCachedFetcher, DailyBudget } from "./cache.ts";
import type { FetchLike } from "./fetch.ts";
import { getIpInfo, type IpInfo } from "./ip-lookup.ts";

export interface IpServiceOptions {
  fetchImpl?: FetchLike;
  ipApiBaseUrl?: string;
  timeoutMs?: number;
  dailyBudget?: number;
  cacheTtlMs?: number;
  enrich?: (info: IpInfo) => Promise<IpInfo>;
}

export type IpService = (ip: string) => Promise<IpInfo>;

export function createIpService(options: IpServiceOptions = {}): IpService {
  const {
    fetchImpl = fetch,
    ipApiBaseUrl = UPSTREAM.ipApiBaseUrl,
    timeoutMs = REQUEST_TIMEOUT_MS,
    dailyBudget = IPAPI_DAILY_BUDGET,
    cacheTtlMs = IP_CACHE_TTL_MS,
    enrich,
  } = options;

  const budget = new DailyBudget(dailyBudget);
  const cached = createCachedFetcher<IpInfo>({
    ttlMs: cacheTtlMs,
    maxEntries: IP_CACHE_MAX_ENTRIES,
    budget,
  });

  return (ip: string) =>
    cached(ip, async () => {
      const base = await getIpInfo(ip, { fetchImpl, ipApiBaseUrl, timeoutMs });
      return enrich ? enrich(base) : base;
    });
}
