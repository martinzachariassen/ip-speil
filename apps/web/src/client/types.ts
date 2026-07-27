// Wire types (IpInfo, GeoCrossCheck, …) are shared with the API via the
// @ip-speil/shared package so the two sides can't drift. Re-exported here so the
// rest of the client keeps importing them from "./types.ts".
export type { GeoCrossCheck, GeoSource, HeaderMap, IpInfo } from "@ip-speil/shared";

export interface IceCandidateInfo {
  type: string;
  address: string;
  scope: string;
}

export interface WebRTCResult {
  pub: string[];
  lan: string[];
  relay: string[];
  mdns: number;
  candidates: IceCandidateInfo[];
}

export type CFTrace = Record<string, string>;

export interface WebGLInfo {
  renderer: string;
  vendor: string;
}

// Which exit IP the browser presents over each transport. `http` is whatever
// family reached our server; `v4`/`v6` are forced single-family probes.
export interface Exits {
  http: string | null;
  v4: string | null;
  v6: string | null;
}

export interface DnsResolver {
  ip?: string;
  country?: string;
  asn?: string;
}

export interface DnsLeakResult {
  available: boolean;
  conclusion?: string;
  resolvers: DnsResolver[];
}

export interface ConnectionInfo {
  type?: string;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

export interface FingerprintData {
  canvas: string | null;
  audio: string | null;
  webgl: WebGLInfo | null;
  screen: string;
  dpr: number;
  cpu: number | null;
  memory: number | null;
  touch: number;
  gamut: string;
  hdr: boolean;
  platform: string;
  fonts: string[];
  voices: number;
  devices: { audioIn: number; audioOut: number; videoIn: number } | null;
  storage: { localStorage: boolean; indexedDB: boolean; cacheAPI: boolean; serviceWorker: boolean };
  languages: string[];
  connection: ConnectionInfo | null;
}

export interface EntropyEstimate {
  bits: number;
  oneIn: string;
  rarity: "low" | "moderate" | "high" | "very high";
}
