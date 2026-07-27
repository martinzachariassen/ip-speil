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
}

// Echoed request headers from /api/headers (hop-by-hop headers stripped).
export type HeaderMap = Record<string, string | string[]>;
