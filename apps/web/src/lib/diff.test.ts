import { expect, test } from "bun:test";

import type { Report } from "../report.ts";
import { diffReports, flattenReport, fmtValue } from "./diff.ts";

// Minimal report factory — only the fields the diff reads need to exist.
function mkReport(overrides: Record<string, unknown> = {}): Report {
  return {
    httpCountry: "US",
    httpNetwork: "AS1 / Example",
    signals: { vpn: false, blocklists: [], fingerprintEntropyBits: 20 },
    webrtc: { publicCount: 0 },
    cloudflare: { colo: "OSL", tls: "TLSv1.3", ech: true },
    ...overrides,
  } as unknown as Report;
}

test("fmtValue normalises primitives, arrays and nullish values", () => {
  expect(fmtValue(null)).toBe("—");
  expect(fmtValue(undefined)).toBe("—");
  expect(fmtValue(true)).toBe("yes");
  expect(fmtValue(false)).toBe("no");
  expect(fmtValue([])).toBe("none");
  expect(fmtValue(["a", "b"])).toBe("a, b");
  expect(fmtValue(5)).toBe("5");
});

test("diffReports lists only changed fields", () => {
  const prev = mkReport({ httpCountry: "US" });
  const curr = mkReport({ httpCountry: "NO" });
  const d = diffReports(prev, curr, "2020-01-01T00:00:00.000Z", false);
  expect(d.changedCount).toBe(1);
  expect(d.fields).toEqual([{ label: "IP country", before: "US", after: "NO" }]);
  expect(d.fingerprintChanged).toBe(false);
  expect(d.savedAt).toBe("2020-01-01T00:00:00.000Z");
});

test("diffReports reports no changes for identical reports", () => {
  const d = diffReports(mkReport(), mkReport(), "2020-01-01T00:00:00.000Z", false);
  expect(d.changedCount).toBe(0);
  expect(d.fields).toEqual([]);
});

test("diffReports counts a changed fingerprint as one change", () => {
  const d = diffReports(mkReport(), mkReport(), "2020-01-01T00:00:00.000Z", true);
  expect(d.fingerprintChanged).toBe(true);
  expect(d.changedCount).toBe(1);
});

test("diffReports detects nested signal and cloudflare changes", () => {
  const prev = mkReport({ signals: { vpn: false, blocklists: [] } });
  const curr = mkReport({ signals: { vpn: true, blocklists: ["spamhaus"] } });
  const d = diffReports(prev, curr, "2020-01-01T00:00:00.000Z", false);
  const labels = d.fields.map((f) => f.label);
  expect(labels).toContain("VPN signal");
  expect(labels).toContain("Blocklist hits");
});

test("flattenReport produces display-ready label/value pairs", () => {
  const flat = flattenReport(mkReport());
  const country = flat.find((f) => f.label === "IP country");
  const ech = flat.find((f) => f.label === "Encrypted Client Hello");
  expect(country?.value).toBe("US");
  expect(ech?.value).toBe("yes");
});
