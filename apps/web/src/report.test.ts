import { expect, test } from "bun:test";

import { buildReport, type ReportInput, redactHostname, redactIp } from "./report.ts";
import type { IpInfo } from "./types.ts";

const IPV4 = "203.0.113.45";
const IPV6 = "2001:db8:1234:5678::1";
const PTR = "203-0-113-45.customer.example.net";

function mkInput(overrides: Partial<ReportInput> = {}): ReportInput {
  const data: IpInfo = {
    status: "success",
    query: IPV4,
    country: "Norway",
    countryCode: "NO",
    isp: "Example ISP",
    asname: "AS64500",
    reverse: PTR,
  };
  return {
    data,
    webrtc: { pub: [], lan: [], relay: [], mdns: 0, candidates: [] },
    exits: { http: IPV4, v4: IPV4, v6: IPV6 },
    ipv6Info: null,
    headers: { "user-agent": "Mozilla/5.0 (probe)" },
    dnsLeak: { available: false, resolvers: [] },
    dnssec: { validates: null, controlReachable: false, brokenReachable: false },
    doh: true,
    entropy: { bits: 20, rarity: "high", contributions: [] },
    ...overrides,
  };
}

test("redactIp keeps a coarse prefix and drops the host bits", () => {
  expect(redactIp(IPV4)).toBe("203.0.x.x");
  expect(redactIp(IPV6)).toBe("2001:db8:…");
  expect(redactIp(null)).toBeNull();
  expect(redactIp("")).toBeNull();
  expect(redactIp("not-an-ip")).toBe("IP redacted");
});

test("redactHostname masks the address digits but keeps the provider tail", () => {
  expect(redactHostname(PTR)).toBe("x-x-x-x.customer.example.net");
  expect(redactHostname("1.2.3.4.static.example.net")).toBe("x.x.x.x.static.example.net");
  expect(redactHostname("gateway.example.net")).toBe("gateway.example.net");
  expect(redactHostname(null)).toBeNull();
  expect(redactHostname("")).toBeNull();
});

test("the report never carries the exact IP, in any field", () => {
  const json = JSON.stringify(buildReport(mkInput()));
  expect(json).not.toContain(IPV4);
  expect(json).not.toContain("203-0-113-45");
  expect(json).not.toContain(IPV6);
});

test("the reverse-DNS field is redacted, not dropped", () => {
  const report = buildReport(mkInput());
  expect(report.reverseDns).toBe("x-x-x-x.customer.example.net");
  expect(report.httpNetwork).toBe("AS64500 / Example ISP");
});

test("a missing reverse-DNS name stays null", () => {
  const input = mkInput();
  const report = buildReport({ ...input, data: { ...input.data, reverse: undefined } });
  expect(report.reverseDns).toBeNull();
});

test("header values are reported by name only", () => {
  const report = buildReport(mkInput());
  expect(report.headersObserved).toEqual(["user-agent"]);
  expect(JSON.stringify(report)).not.toContain("Mozilla/5.0 (probe)");
});
