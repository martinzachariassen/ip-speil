// Wire types (IpInfo, GeoCrossCheck, …) are shared with the API via the
// @ip-speil/shared package so the two sides can't drift. Re-exported here so the
// rest of the client keeps importing them from "./types.ts".
export type {
  GeoCrossCheck,
  GeoSource,
  HeaderMap,
  IpInfo,
  RoutingInfo,
  RpkiInfo,
} from "@ip-speil/shared";

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
  // Which provider answered ("bash.ws"), or undefined when the test could not run.
  source?: string;
}

export interface DnssecResult {
  // true = the resolver validates DNSSEC (it blocked a deliberately-broken
  // domain); false = it does not; null = inconclusive (control unreachable).
  validates: boolean | null;
  controlReachable: boolean;
  brokenReachable: boolean;
}

// What persistent-storage surfaces are reachable from this page. Each boolean is
// the result of a write-then-cleanup probe (or a capability check); the audit
// never leaves data behind. `quotaMb` is the origin's reported storage budget.
export interface StorageAudit {
  cookies: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  indexedDB: boolean;
  cacheAPI: boolean;
  serviceWorker: boolean;
  storageAccessApi: boolean;
  quotaMb: number | null;
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
  storage: StorageAudit;
  languages: string[];
  connection: ConnectionInfo | null;
}

export interface EntropyContribution {
  label: string;
  bits: number;
}

export interface EntropyEstimate {
  bits: number;
  rarity: "low" | "moderate" | "high" | "very high";
  // Per-signal breakdown (present signals only, sorted most→least identifying).
  // We deliberately do NOT publish a "1 in N browsers" figure: we have no
  // measured population, so any such number would be fabricated.
  contributions: EntropyContribution[];
}
