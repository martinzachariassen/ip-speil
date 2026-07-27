import type { GeoCrossCheck, GeoSource, IpInfo } from "@ip-speil/shared";

import { REQUEST_TIMEOUT_MS, UPSTREAM } from "../config.ts";
import { datasetMeta, getGeoDb } from "../geoip/load.ts";
import { countryName, type LocalGeo } from "../geoip/store.ts";
import { isProbablyIp, isUnroutableIp } from "./client-ip.ts";
import { type FetchLike, fetchJson } from "./fetch.ts";

// Re-exported so the rest of the API keeps importing these from here; the
// canonical definitions live in @ip-speil/shared (shared with the client).
export type { FetchLike, GeoCrossCheck, GeoSource, IpInfo };

// Conservative datacenter/hosting inference from the ASN org name. Local datasets
// don't carry a datacenter flag, so we only set hosting=true on a keyword hit and
// leave it undefined otherwise (never a fabricated false).
const HOSTING_KEYWORDS = [
  "amazon",
  "aws",
  "google",
  "microsoft",
  "azure",
  "ovh",
  "hetzner",
  "digitalocean",
  "linode",
  "vultr",
  "cloudflare",
  "oracle cloud",
  "alibaba",
  "tencent",
  "contabo",
  "leaseweb",
  "scaleway",
  "gcore",
  "akamai",
  "fastly",
  "hosting",
  "datacenter",
  "data center",
  "colocation",
  "colo ",
];

function inferHosting(org: string | undefined): boolean | undefined {
  if (!org) return undefined;
  const lc = org.toLowerCase();
  return HOSTING_KEYWORDS.some((k) => lc.includes(k)) ? true : undefined;
}

export interface IpLookupOptions {
  // Local dataset lookup (defaults to the module-singleton GeoDb).
  geoLookup?: (ip: string) => LocalGeo | null;
  // Tor exit membership (defaults to "never" so tests stay offline).
  isTorExit?: (ip: string) => boolean;
  // Off-by-default online tiebreaker; only when true do we call ipapi.is.
  enableOnlineTiebreaker?: boolean;
  fetchImpl?: FetchLike;
  ipApiBaseUrl?: string;
  timeoutMs?: number;
}

/**
 * Resolve an IP entirely from local datasets — ZERO outbound requests carrying
 * the visitor IP. VPN/proxy/abuser aren't derivable locally and stay undefined;
 * `tor` comes from the exit list, `hosting` from ASN-org keywords.
 */
export async function getIpInfo(ip: string, opts: IpLookupOptions = {}): Promise<IpInfo> {
  const {
    geoLookup = (x) => getGeoDb()?.lookup(x) ?? null,
    isTorExit = () => false,
    enableOnlineTiebreaker = false,
    fetchImpl = fetch,
    ipApiBaseUrl = UPSTREAM.ipApiBaseUrl,
    timeoutMs = REQUEST_TIMEOUT_MS,
  } = opts;

  const valid = isProbablyIp(ip);
  const geo = valid ? geoLookup(ip) : null;
  const base = normaliseLocal(ip, valid, geo, isTorExit);

  if (enableOnlineTiebreaker && valid) {
    try {
      const online = await fetchJson<IpapiIsResponse>(
        fetchImpl,
        `${ipApiBaseUrl}/?q=${encodeURIComponent(ip)}`,
        timeoutMs,
      );
      if (!online.error) return mergeOnline(base, online);
    } catch {
      // Tiebreaker is best-effort — fall back to the local-only result.
    }
  }

  return base;
}

function normaliseLocal(
  ip: string,
  valid: boolean,
  geo: LocalGeo | null,
  isTorExit: (ip: string) => boolean,
): IpInfo {
  const datasetDate = datasetMeta()?.builtAt;
  if (!valid) {
    return { status: "fail", query: ip || undefined, datasetDate };
  }

  const countryCode = geo?.countryCode ?? geo?.asnCountry;
  const country = geo?.country ?? countryName(geo?.asnCountry);
  const org = geo?.org;

  return {
    status: "success",
    query: ip,
    country,
    countryCode,
    region: geo?.region,
    regionName: geo?.region,
    city: geo?.city,
    lat: geo?.lat,
    lon: geo?.lon,
    isp: org,
    org,
    as: geo?.asn != null ? `AS${geo.asn}` : undefined,
    asname: geo?.asName,
    hosting: inferHosting(org),
    tor: isTorExit(ip) ? true : undefined,
    bogon: isUnroutableIp(ip) ? true : undefined,
    datasetDate,
  };
}

// --- Optional online tiebreaker (ipapi.is) — off by default ------------------
// Only reached when enableOnlineTiebreaker is true. Kept so an operator can
// opt back into VPN/proxy/abuser flags at the cost of sending the IP upstream.

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
}

function mergeOnline(base: IpInfo, d: IpapiIsResponse): IpInfo {
  return {
    ...base,
    mobile: d.is_mobile ?? base.mobile,
    hosting: d.is_datacenter ?? base.hosting,
    tor: d.is_tor ?? base.tor,
    proxy: d.is_proxy ?? base.proxy,
    vpn: d.is_vpn ?? base.vpn,
    abuser: d.is_abuser ?? base.abuser,
    bogon: d.is_bogon ?? base.bogon,
  };
}
