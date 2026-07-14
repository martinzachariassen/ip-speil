import type { EntropyEstimate, FingerprintData, IpInfo, WebRTCResult } from "../types.ts";

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

export function timezoneCheck(d: IpInfo | null | undefined): TimezoneCheck {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const nameMismatch = !!(d?.timezone && browserTz !== d.timezone);
  let offsetMismatch = false;
  if (d?.offset != null) {
    // getTimezoneOffset() is minutes *behind* UTC; the IP offset is seconds
    // *ahead* of UTC. Normalise both to minutes east of UTC before comparing.
    const browserOffsetMin = -new Date().getTimezoneOffset();
    offsetMismatch = browserOffsetMin !== Math.round(d.offset / 60);
  }
  return { browserTz, nameMismatch, offsetMismatch };
}

export interface LanguageGeoCheck {
  mismatch: boolean;
  langRegion?: string;
}

// Browser locale region (en-US → US) vs the IP country. Soft signal — many
// browsers report a language with no region subtag, in which case we say nothing.
export function languageGeoCheck(countryCode: string | undefined): LanguageGeoCheck {
  if (!countryCode) return { mismatch: false };
  const langs = navigator.languages?.length ? navigator.languages : [navigator.language];
  const regions = langs.map((l) => l.split("-")[1]?.toUpperCase()).filter((r): r is string => !!r);
  if (regions.length === 0) return { mismatch: false };
  return { mismatch: !regions.includes(countryCode.toUpperCase()), langRegion: regions[0] };
}

// A deliberately rough, educational entropy estimate (EFF Cover-Your-Tracks
// style): weight each distinguishing signal that is present and non-default,
// sum to bits, and express as "1 in 2^bits". Weights are conservative because
// the signals are correlated — this is an order-of-magnitude gauge, not a
// precise uniqueness measure.
const ENTROPY_WEIGHTS: { has: (fp: FingerprintData) => boolean; bits: number }[] = [
  { has: (fp) => !!fp.canvas, bits: 6 },
  { has: (fp) => !!fp.audio, bits: 4 },
  { has: (fp) => !!fp.webgl, bits: 5 },
  { has: (fp) => fp.fonts.length > 0, bits: 3 },
  { has: (fp) => fp.voices > 0, bits: 2 },
  { has: () => true, bits: 3 }, // screen + dpr
  { has: (fp) => fp.cpu != null, bits: 1 },
  { has: (fp) => fp.memory != null, bits: 1 },
  { has: (fp) => fp.touch > 0, bits: 1 },
  { has: (fp) => fp.gamut !== "sRGB" && fp.gamut !== "unknown", bits: 1 },
  { has: (fp) => fp.hdr, bits: 1 },
  { has: (fp) => !!fp.platform && fp.platform !== "Not exposed", bits: 1 },
  { has: (fp) => fp.languages.length > 1, bits: 2 },
];

export function estimateEntropy(fp: FingerprintData): EntropyEstimate {
  const bits = ENTROPY_WEIGHTS.reduce((sum, w) => (w.has(fp) ? sum + w.bits : sum), 0);
  const rarity = bits >= 26 ? "very high" : bits >= 18 ? "high" : bits >= 10 ? "moderate" : "low";
  return { bits, oneIn: formatBigCount(2 ** bits), rarity };
}

function formatBigCount(n: number): string {
  if (n >= 1e12) return "over a trillion";
  if (n >= 1e9) return `${Math.round(n / 1e9)} billion`;
  if (n >= 1e6) return `${Math.round(n / 1e6)} million`;
  if (n >= 1e3) return `${Math.round(n / 1e3)} thousand`;
  return String(Math.round(n));
}
