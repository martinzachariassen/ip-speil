import { REQUEST_TIMEOUT_MS, UPSTREAM } from "../config.ts";
import type { FetchLike } from "./fetch.ts";

export type { FetchLike };

// Field names mirror the legacy ip-api.com shape so the frontend doesn't churn;
// ipapi.is' richer signals (tor/vpn/abuser) and our own enrichment sit on top.
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
  tor?: boolean;
  vpn?: boolean;
  abuser?: boolean;
  bogon?: boolean;
  reverse?: string;
  blocklists?: string[];
  geo?: GeoCrossCheck;
}

export interface GeoSource {
  name: string;
  country?: string;
  countryCode?: string;
  city?: string;
  asn?: string;
}

export interface GeoCrossCheck {
  agree: number;
  total: number;
  countryCode?: string;
  sources: GeoSource[];
}

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
  rir?: string;
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
  fetchImpl?: FetchLike;
  ipApiBaseUrl?: string;
  timeoutMs?: number;
}

export async function getIpInfo(
  ip: string,
  {
    fetchImpl = fetch,
    ipApiBaseUrl = UPSTREAM.ipApiBaseUrl,
    timeoutMs = REQUEST_TIMEOUT_MS,
  }: IpLookupOptions = {},
): Promise<IpInfo> {
  const url = `${ipApiBaseUrl}/?q=${encodeURIComponent(ip)}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });

  if (!res.ok) throw new Error(`ipapi.is responded with ${res.status}`);

  const data = (await res.json()) as IpapiIsResponse;
  if (data?.error) throw new Error(data.error);

  return normalise(data);
}

function normalise(d: IpapiIsResponse): IpInfo {
  const loc = d.location ?? {};
  const company = d.company ?? {};
  const asn = d.asn ?? {};

  const asString = asn.asn != null ? `AS${asn.asn}${asn.route ? ` ${asn.route}` : ""}` : undefined;

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
    offset: parseUtcOffsetSeconds(loc.utcoffset),
    isp: company.name || asn.org,
    org: company.name || asn.org,
    as: asString,
    asname: asn.org || asn.descr || undefined,
    mobile: d.is_mobile,
    proxy: d.is_proxy,
    hosting: d.is_datacenter,
    tor: d.is_tor,
    vpn: d.is_vpn,
    abuser: d.is_abuser,
    bogon: d.is_bogon,
  };
}

function parseUtcOffsetSeconds(utcOffset: string | undefined): number | undefined {
  if (!utcOffset) return undefined;
  const match = utcOffset.match(/^([+-])(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 3600 + Number(match[3]) * 60);
}
