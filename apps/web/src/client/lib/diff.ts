import type { Report } from "../report.ts";

export interface DiffField {
  label: string;
  before: string;
  after: string;
}

export interface SnapshotDiff {
  savedAt: string;
  fields: DiffField[];
  fingerprintChanged: boolean;
  // Total number of changes, counting the fingerprint as one.
  changedCount: number;
}

// The fields we track across scans. Getters use optional chaining so a
// hand-edited or malformed shared payload can't throw. Fingerprint hashes are
// deliberately NOT here — they are compared separately and shown only as
// changed/unchanged, never printed.
const FIELDS: { label: string; get: (r: Report) => unknown }[] = [
  { label: "Public IP", get: (r) => r.httpIp },
  { label: "IP country", get: (r) => r.httpCountry },
  { label: "Network / ISP", get: (r) => r.httpNetwork },
  { label: "Reverse DNS", get: (r) => r.reverseDns },
  { label: "IPv6 exit", get: (r) => r.ipv6 },
  { label: "IPv6 country", get: (r) => r.ipv6Country },
  { label: "VPN signal", get: (r) => r.signals?.vpn },
  { label: "Proxy signal", get: (r) => r.signals?.proxy },
  { label: "Tor exit", get: (r) => r.signals?.tor },
  { label: "Datacenter / hosting", get: (r) => r.signals?.hosting },
  { label: "Mobile network", get: (r) => r.signals?.mobile },
  { label: "Blocklist hits", get: (r) => r.signals?.blocklists },
  { label: "DoH reachable", get: (r) => r.signals?.dohReachable },
  { label: "DNS resolvers seen", get: (r) => r.signals?.dnsResolverCount },
  { label: "Foreign DNS resolvers", get: (r) => r.signals?.dnsForeignResolvers },
  { label: "Timezone mismatch", get: (r) => r.signals?.timezoneMismatch },
  { label: "WebRTC IP leak", get: (r) => r.signals?.webrtcDifferentPublicIp },
  { label: "WebRTC public IPs", get: (r) => r.webrtc?.publicCount },
  { label: "Fingerprint entropy (bits)", get: (r) => r.signals?.fingerprintEntropyBits },
  { label: "CF datacenter", get: (r) => r.cloudflare?.colo ?? null },
  { label: "CF sees country", get: (r) => r.cloudflare?.loc ?? null },
  { label: "Cloudflare WARP", get: (r) => r.cloudflare?.warp ?? null },
  { label: "HTTP version", get: (r) => r.cloudflare?.http ?? null },
  { label: "TLS version", get: (r) => r.cloudflare?.tls ?? null },
  { label: "Encrypted Client Hello", get: (r) => r.cloudflare?.ech ?? null },
];

export function fmtValue(v: unknown): string {
  if (v == null) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "none";
  return String(v);
}

// A flat, display-ready view of a report — used for the read-only shared view.
export function flattenReport(r: Report): { label: string; value: string }[] {
  return FIELDS.map((f) => ({ label: f.label, value: fmtValue(f.get(r)) }));
}

// Pure diff of two reports. `fingerprintChanged` is passed in because the
// fingerprint id lives outside the redacted report (it never leaves the device).
export function diffReports(
  prev: Report,
  curr: Report,
  savedAt: string,
  fingerprintChanged: boolean,
): SnapshotDiff {
  const fields: DiffField[] = [];
  for (const f of FIELDS) {
    const before = fmtValue(f.get(prev));
    const after = fmtValue(f.get(curr));
    if (before !== after) fields.push({ label: f.label, before, after });
  }
  return {
    savedAt,
    fields,
    fingerprintChanged,
    changedCount: fields.length + (fingerprintChanged ? 1 : 0),
  };
}
