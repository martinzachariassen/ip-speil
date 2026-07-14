// Shared client-side data shapes. The server sends the `IpInfo` shape from
// /api/info; the rest describe values assembled in the browser.

/** The /api/info response as the client consumes it (all fields optional). */
export interface IpInfo {
  status?: "success" | "fail";
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
  reverse?: string;
  mobile?: boolean;
  proxy?: boolean;
  hosting?: boolean;
  tor?: boolean;
  vpn?: boolean;
  abuser?: boolean;
  bogon?: boolean;
}

/** A single WebRTC ICE candidate we surface to the user. */
export interface IceCandidateInfo {
  type: string;
  address: string;
  scope: string;
}

/** Aggregated WebRTC probe result. */
export interface WebRTCResult {
  pub: string[];
  lan: string[];
  relay: string[];
  mdns: number;
  candidates: IceCandidateInfo[];
}

/** Parsed Cloudflare `cdn-cgi/trace` key/value report. */
export type CFTrace = Record<string, string>;

/** WebGL renderer/vendor strings. */
export interface WebGLInfo {
  renderer: string;
  vendor: string;
}

/** Headers echoed by /api/headers. */
export type HeaderMap = Record<string, string | string[]>;
