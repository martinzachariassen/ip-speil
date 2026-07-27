import type {
  DnsResolver,
  EntropyContribution,
  EntropyEstimate,
  FingerprintData,
  IpInfo,
  WebRTCResult,
} from "../types.ts";

const VPN_KEYWORDS = ["vpn", "proxy", "anonymi", "vps", "virtual private"];
const HOSTING_KEYWORDS = [
  "hosting",
  "cloud",
  "digitalocean",
  "linode",
  "vultr",
  "amazon",
  "google cloud",
  "azure",
  "hetzner",
  "ovh",
  "datacenter",
  "colocation",
  "serverius",
];

function nameText(d: IpInfo | null | undefined): string {
  return `${d?.isp || ""} ${d?.org || ""} ${d?.asname || ""}`.toLowerCase();
}

export function ispSuggestsVpn(d: IpInfo | null | undefined): boolean {
  const text = nameText(d);
  return VPN_KEYWORDS.some((k) => text.includes(k));
}

export function ispSuggestsHosting(d: IpInfo | null | undefined): boolean {
  const text = nameText(d);
  return HOSTING_KEYWORDS.some((k) => text.includes(k));
}

export function isVpnSignal(d: IpInfo): boolean {
  return d.proxy === true || d.vpn === true || d.tor === true || ispSuggestsVpn(d);
}

function ipFamily(ip: string): 4 | 6 | 0 {
  if (!ip) return 0;
  return ip.includes(":") ? 6 : 4;
}

// Only compares within one IP family — an IPv6 srflx candidate against an IPv4
// HTTP IP is a different address, not a leak.
export function isForeignPublicIp(ip: string, httpIp: string | undefined): boolean {
  if (!httpIp) return false;
  return ipFamily(ip) === ipFamily(httpIp) && ip !== httpIp;
}

// The single WebRTC-leak verdict used everywhere.
export function webrtcLeak(webrtc: WebRTCResult, httpIp: string | undefined): boolean {
  return webrtc.pub.some((ip) => isForeignPublicIp(ip, httpIp));
}

export interface TimezoneCheck {
  browserTz: string;
  nameMismatch: boolean;
  offsetMismatch: boolean;
}

export interface TimezoneEnv {
  browserTz: string;
  // Minutes east of UTC (i.e. -Date#getTimezoneOffset()).
  browserOffsetMin: number;
}

// Reads the live browser timezone. Split out so timezoneCheck stays a pure,
// testable function of (ip-data, env).
function liveTimezoneEnv(): TimezoneEnv {
  return {
    browserTz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    browserOffsetMin: -new Date().getTimezoneOffset(),
  };
}

export function timezoneCheck(
  d: IpInfo | null | undefined,
  env: TimezoneEnv = liveTimezoneEnv(),
): TimezoneCheck {
  const { browserTz, browserOffsetMin } = env;
  const nameMismatch = !!(d?.timezone && browserTz !== d.timezone);
  let offsetMismatch = false;
  if (d?.offset != null) {
    // getTimezoneOffset() is minutes *behind* UTC; the IP offset is seconds
    // *ahead* of UTC. Normalise both to minutes east of UTC before comparing.
    offsetMismatch = browserOffsetMin !== Math.round(d.offset / 60);
  }
  return { browserTz, nameMismatch, offsetMismatch };
}

export interface LanguageGeoCheck {
  mismatch: boolean;
  langRegion?: string;
}

function liveLanguages(): readonly string[] {
  return navigator.languages?.length ? navigator.languages : [navigator.language];
}

// Browser locale region (en-US → US) vs the IP country. Soft signal — many
// browsers report a language with no region subtag, in which case we say nothing.
// `langs` is injectable so the check is unit-testable without a real navigator.
export function languageGeoCheck(
  countryCode: string | undefined,
  langs: readonly string[] = liveLanguages(),
): LanguageGeoCheck {
  if (!countryCode) return { mismatch: false };
  const regions = langs.map((l) => l.split("-")[1]?.toUpperCase()).filter((r): r is string => !!r);
  if (regions.length === 0) return { mismatch: false };
  return { mismatch: !regions.includes(countryCode.toUpperCase()), langRegion: regions[0] };
}

// Resolvers whose country differs from the connection's country — the DNS-leak
// signal. Pure so it can be unit-tested and reused by report + exposure.
export function foreignResolvers(
  resolvers: readonly DnsResolver[],
  country: string | undefined,
): DnsResolver[] {
  if (!country) return [];
  return resolvers.filter((r) => r.country && r.country !== country);
}

// A deliberately rough, educational entropy estimate in the spirit of the EFF's
// Cover Your Tracks methodology: attribute bits of identifying information to
// each distinguishing signal that is present and non-default, and sum them.
//
// We report the *per-signal contributions* and the total, NOT a "1 in N
// browsers" figure. The old code derived "1 in 2^bits" from these same weights,
// which dressed a made-up number up as a measured population statistic — we have
// no corpus, so we don't claim one. Weights are conservative order-of-magnitude
// values (signals are correlated); treat this as a gauge, not a proof.
const ENTROPY_WEIGHTS: { label: string; has: (fp: FingerprintData) => boolean; bits: number }[] = [
  { label: "Canvas rendering", has: (fp) => !!fp.canvas, bits: 6 },
  { label: "WebGL / GPU", has: (fp) => !!fp.webgl, bits: 5 },
  { label: "Audio stack", has: (fp) => !!fp.audio, bits: 4 },
  { label: "Screen & pixel ratio", has: () => true, bits: 3 },
  { label: "Installed fonts", has: (fp) => fp.fonts.length > 0, bits: 3 },
  { label: "Speech voices", has: (fp) => fp.voices > 0, bits: 2 },
  { label: "Multiple languages", has: (fp) => fp.languages.length > 1, bits: 2 },
  { label: "CPU threads", has: (fp) => fp.cpu != null, bits: 1 },
  { label: "Device memory", has: (fp) => fp.memory != null, bits: 1 },
  { label: "Touch support", has: (fp) => fp.touch > 0, bits: 1 },
  {
    label: "Wide colour gamut",
    has: (fp) => fp.gamut !== "sRGB" && fp.gamut !== "unknown",
    bits: 1,
  },
  { label: "HDR display", has: (fp) => fp.hdr, bits: 1 },
  { label: "Platform", has: (fp) => !!fp.platform && fp.platform !== "Not exposed", bits: 1 },
];

export function estimateEntropy(fp: FingerprintData): EntropyEstimate {
  const contributions: EntropyContribution[] = ENTROPY_WEIGHTS.filter((w) => w.has(fp))
    .map((w) => ({ label: w.label, bits: w.bits }))
    .sort((a, b) => b.bits - a.bits);
  const bits = contributions.reduce((sum, c) => sum + c.bits, 0);
  const rarity = bits >= 26 ? "very high" : bits >= 18 ? "high" : bits >= 10 ? "moderate" : "low";
  return { bits, rarity, contributions };
}
