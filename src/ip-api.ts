import type { IncomingHttpHeaders } from "node:http";

/** Default timeout for upstream ip-api.com requests, in milliseconds. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

/** Fields requested from ip-api.com, in a single comma-separated list. */
const IP_API_FIELDS = [
  "status",
  "message",
  "country",
  "countryCode",
  "region",
  "regionName",
  "city",
  "zip",
  "lat",
  "lon",
  "timezone",
  "offset",
  "isp",
  "org",
  "as",
  "asname",
  "reverse",
  "mobile",
  "proxy",
  "hosting",
  "query",
].join(",");

/** Shape of a successful (or failed) ip-api.com lookup. All fields are optional. */
export interface IpApiResponse {
  status?: "success" | "fail";
  message?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  offset?: number;
  isp?: string;
  org?: string;
  as?: string;
  asname?: string;
  reverse?: string;
  mobile?: boolean;
  proxy?: boolean;
  hosting?: boolean;
  query?: string;
}

export interface IpInfoOptions {
  fetchImpl?: typeof fetch;
  ipApiBaseUrl?: string;
  timeoutMs?: number;
}

/**
 * Extract the originating client IP from proxy headers.
 * Prefers the first address in `x-forwarded-for`, falling back to `x-real-ip`.
 */
export function getClientIp(headers: IncomingHttpHeaders): string {
  const forwarded = headers["x-forwarded-for"];
  const realIp = headers["x-real-ip"];

  if (typeof forwarded === "string") {
    return forwarded.split(",")[0]?.trim() ?? "";
  }

  if (Array.isArray(forwarded)) {
    return forwarded[0]?.split(",")[0]?.trim() ?? "";
  }

  return typeof realIp === "string" ? realIp.trim() : "";
}

/**
 * Look up geolocation/network metadata for an IP via ip-api.com.
 * Pass an empty `ip` to look up the caller's own address.
 */
export async function getIpInfo(
  ip: string,
  {
    fetchImpl = fetch,
    ipApiBaseUrl = "http://ip-api.com",
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  }: IpInfoOptions = {},
): Promise<IpApiResponse> {
  const path = ip ? `/json/${encodeURIComponent(ip)}` : "/json/";
  const res = await fetchImpl(`${ipApiBaseUrl}${path}?fields=${IP_API_FIELDS}`, {
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`ip-api responded with ${res.status}`);
  }

  const data = (await res.json()) as IpApiResponse;
  if (data?.status === "fail") {
    throw new Error(data.message || "ip-api lookup failed");
  }

  return data;
}
