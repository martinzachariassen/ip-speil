import type { IncomingHttpHeaders } from "node:http";

/** Default timeout for upstream ipapi.is requests, in milliseconds. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

/** Upstream base URL — ipapi.is offers free HTTPS with 1k req/day, no key. */
const DEFAULT_BASE_URL = "https://api.ipapi.is";

/**
 * Normalised IP lookup result. Field names mirror the legacy ip-api.com shape
 * so the frontend doesn't churn; richer signals from ipapi.is (tor/vpn/abuser)
 * are added on top.
 */
export interface IpInfo {
  status: "success" | "fail";
  message?: string;
  query?: string;
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
  mobile?: boolean;
  proxy?: boolean;
  hosting?: boolean;
  /** Tor exit node — surfaced by ipapi.is. */
  tor?: boolean;
  /** Known VPN service (separate from generic proxy). */
  vpn?: boolean;
  /** Address has been reported for abuse. */
  abuser?: boolean;
  /** Private / reserved / unroutable address (RFC1918, link-local, …). */
  bogon?: boolean;
}

/** Subset of the ipapi.is response shape we read. */
interface IpapiIsResponse {
  ip?: string;
  error?: string;
  is_bogon?: boolean;
  is_mobile?: boolean;
  is_datacenter?: boolean;
  is_tor?: boolean;
  is_proxy?: boolean;
  is_vpn?: boolean;
  is_abuser?: boolean;
  company?: { name?: string; domain?: string };
  asn?: { asn?: number; descr?: string; org?: string; route?: string };
  location?: {
    country?: string;
    country_code?: string;
    state?: string;
    city?: string;
    zip?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    utcoffset?: string;
  };
}

export interface IpLookupOptions {
  fetchImpl?: typeof fetch;
  ipApiBaseUrl?: string;
  timeoutMs?: number;
}

/**
 * Extract the originating client IP from proxy headers, falling back to the raw
 * socket address. Order: first entry of `x-forwarded-for`, then `x-real-ip`,
 * then `socketRemoteAddress`. Unroutable socket addresses (loopback, RFC 1918,
 * link-local, ULA) collapse to `""` so the caller can let ipapi.is fall back to
 * the request source IP — that way `localhost:3000` still resolves the dev
 * machine's WAN IP and the UI gets real data.
 */
export function getClientIp(headers: IncomingHttpHeaders, socketRemoteAddress?: string): string {
  const forwarded = headers["x-forwarded-for"];
  const realIp = headers["x-real-ip"];

  if (typeof forwarded === "string") {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  } else if (Array.isArray(forwarded)) {
    const first = forwarded[0]?.split(",")[0]?.trim();
    if (first) return first;
  }

  if (typeof realIp === "string") {
    const trimmed = realIp.trim();
    if (trimmed) return trimmed;
  }

  const socket = normaliseSocketAddress(socketRemoteAddress);
  return isUnroutableIp(socket) ? "" : socket;
}

/** Strip the IPv6-mapped IPv4 prefix (`::ffff:1.2.3.4` → `1.2.3.4`). */
function normaliseSocketAddress(address: string | undefined): string {
  if (!address) return "";
  return address.startsWith("::ffff:") ? address.slice(7) : address;
}

/**
 * True for addresses that have no meaningful global geolocation: IPv4/IPv6
 * loopback, IPv4 RFC 1918 private ranges, IPv4 link-local (169.254/16),
 * IPv6 link-local (fe80::/10), and IPv6 unique-local (fc00::/7).
 */
export function isUnroutableIp(ip: string): boolean {
  if (!ip) return false;
  if (ip === "::1" || ip === "::") return true;
  if (ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (ip.startsWith("169.254.")) return true;
  if (ip.startsWith("172.")) {
    const second = Number(ip.split(".")[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (/^f[cd][0-9a-f]{2}:/i.test(ip)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(ip)) return true;
  return false;
}

/**
 * Look up geolocation/network metadata for an IP via ipapi.is.
 * Pass an empty `ip` to look up the caller's own address.
 */
export async function getIpInfo(
  ip: string,
  {
    fetchImpl = fetch,
    ipApiBaseUrl = DEFAULT_BASE_URL,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  }: IpLookupOptions = {},
): Promise<IpInfo> {
  const url = `${ipApiBaseUrl}/?q=${encodeURIComponent(ip)}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });

  if (!res.ok) {
    throw new Error(`ipapi.is responded with ${res.status}`);
  }

  const data = (await res.json()) as IpapiIsResponse;
  if (data?.error) {
    throw new Error(data.error);
  }

  return normalise(data);
}

/** Translate the upstream ipapi.is response into our canonical IpInfo shape. */
function normalise(d: IpapiIsResponse): IpInfo {
  const loc = d.location ?? {};
  const company = d.company ?? {};
  const asn = d.asn ?? {};

  const asString = asn.asn != null ? `AS${asn.asn}${asn.route ? ` ${asn.route}` : ""}` : undefined;
  const asNameValue = asn.org || asn.descr || undefined;
  const offset = parseUtcOffsetSeconds(loc.utcoffset);

  return {
    status: d.ip ? "success" : "fail",
    query: d.ip,
    country: loc.country,
    countryCode: loc.country_code,
    region: loc.state,
    regionName: loc.state,
    city: loc.city,
    zip: loc.zip,
    lat: loc.latitude,
    lon: loc.longitude,
    timezone: loc.timezone,
    offset,
    isp: company.name || asn.org,
    org: company.name || asn.org,
    as: asString,
    asname: asNameValue,
    mobile: d.is_mobile,
    proxy: d.is_proxy,
    hosting: d.is_datacenter,
    tor: d.is_tor,
    vpn: d.is_vpn,
    abuser: d.is_abuser,
    bogon: d.is_bogon,
  };
}

/** Parse an "±HH:MM" UTC offset string into seconds. Returns undefined if absent. */
function parseUtcOffsetSeconds(utcOffset: string | undefined): number | undefined {
  if (!utcOffset) return undefined;
  const match = utcOffset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  return sign * (hours * 3600 + minutes * 60);
}
