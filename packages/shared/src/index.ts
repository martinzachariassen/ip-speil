// Wire types shared across the API (producer) and the web client (consumer).
// Keeping the single source of truth here prevents the two IpInfo shapes from
// drifting the way they did when each side declared its own.

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

// A signed Route Origin Authorisation matched by RPKI validation.
export interface RpkiRoa {
  origin: string;
  prefix: string;
  maxLength?: number;
  validity?: string;
}

export interface RpkiInfo {
  // Route-origin validation of (originAsn, prefix). "unknown" — no ROA covers the
  // prefix — is the common case and is not a failure.
  state: "valid" | "invalid" | "unknown";
  roas?: RpkiRoa[];
}

// Routing/BGP context resolved from RIPEstat (free, no key). Only a truncated
// network block is sent upstream — see RoutingInfo.queried.
export interface RoutingInfo {
  // The announced BGP prefix covering the visitor's network.
  prefix?: string;
  // The ASN announcing that prefix, e.g. "AS15169".
  originAsn?: string;
  // RPKI route-origin validation for (originAsn, prefix).
  rpki?: RpkiInfo;
  // Abuse-contact addresses registered for the resource (public registry data).
  abuseContacts?: string[];
  // The network block actually sent to RIPEstat — the visitor's host bits are
  // zeroed first, so the exact address never leaves the server. Surfaced so the
  // UI can be honest about what was queried.
  queried?: string;
}

// The /api/info response. All fields are optional so the client can treat the
// payload defensively; the API always sets `status`, `query`, etc. on success.
export interface IpInfo {
  status?: "success" | "fail";
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
  // Routing/RPKI/abuse context from RIPEstat (see apps/api/src/lib/routing.ts).
  routing?: RoutingInfo;
  // ISO timestamp of the local geoip dataset build (see apps/api/src/geoip).
  datasetDate?: string;
}

// Echoed request headers from /api/headers (hop-by-hop headers stripped).
export type HeaderMap = Record<string, string | string[]>;
