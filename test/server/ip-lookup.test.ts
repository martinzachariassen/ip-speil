import { expect, test } from "bun:test";

import { getClientIp, isProbablyIp, isUnroutableIp } from "../../src/server/lib/client-ip.ts";
import { type FetchLike, getIpInfo } from "../../src/server/lib/ip-lookup.ts";

const headers = (init: Record<string, string>) => new Headers(init);

test("getClientIp prefers the first forwarded address", () => {
  expect(
    getClientIp(
      headers({
        "x-forwarded-for": "203.0.113.10, 198.51.100.20",
        "x-real-ip": "198.51.100.30",
      }),
    ),
  ).toBe("203.0.113.10");
});

test("getClientIp falls back to x-real-ip", () => {
  expect(getClientIp(headers({ "x-real-ip": "198.51.100.30" }))).toBe("198.51.100.30");
});

test("getClientIp falls back to the socket address when no proxy headers are present", () => {
  expect(getClientIp(headers({}), "203.0.113.50")).toBe("203.0.113.50");
});

test("getClientIp strips the IPv6-mapped IPv4 prefix from the socket address", () => {
  expect(getClientIp(headers({}), "::ffff:203.0.113.50")).toBe("203.0.113.50");
});

test("getClientIp collapses unroutable socket addresses to empty", () => {
  expect(getClientIp(headers({}), "::1")).toBe("");
  expect(getClientIp(headers({}), "127.0.0.1")).toBe("");
  expect(getClientIp(headers({}), "::ffff:127.0.0.1")).toBe("");
  expect(getClientIp(headers({}), "192.168.1.42")).toBe("");
});

test("getClientIp prefers x-forwarded-for over the socket address", () => {
  expect(getClientIp(headers({ "x-forwarded-for": "203.0.113.10" }), "::1")).toBe("203.0.113.10");
});

test("getClientIp returns an empty string when nothing is available", () => {
  expect(getClientIp(headers({}))).toBe("");
});

test("isProbablyIp accepts valid IPv4 and IPv6, rejects junk", () => {
  expect(isProbablyIp("8.8.8.8")).toBe(true);
  expect(isProbablyIp("2001:db8::1")).toBe(true);
  expect(isProbablyIp("not-an-ip")).toBe(false);
  expect(isProbablyIp("999.999.999.999")).toBe(false);
  expect(isProbablyIp("")).toBe(false);
});

test("isUnroutableIp recognises loopback, RFC 1918, link-local, and ULA addresses", () => {
  for (const ip of [
    "::1",
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "172.16.0.1",
    "172.31.255.255",
    "169.254.0.1",
    "fe80::1",
    "fc00::1",
    "fd12:3456:789a::1",
  ]) {
    expect(isUnroutableIp(ip)).toBe(true);
  }
});

test("isUnroutableIp lets public addresses through", () => {
  for (const ip of ["203.0.113.10", "8.8.8.8", "172.15.0.1", "172.32.0.1", "2001:db8::1"]) {
    expect(isUnroutableIp(ip)).toBe(false);
  }
});

test("getIpInfo encodes the requested ip and normalises the response", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(String(url));
    return Response.json({
      ip: "2001:db8::1",
      is_bogon: false,
      is_mobile: false,
      is_datacenter: true,
      is_tor: false,
      is_proxy: false,
      is_vpn: true,
      is_abuser: false,
      company: { name: "Example ISP" },
      asn: {
        asn: 64500,
        descr: "EXAMPLE - Example, US",
        org: "Example LLC",
        route: "2001:db8::/32",
      },
      location: {
        country: "Examplestan",
        country_code: "EX",
        state: "Sample State",
        city: "Sample City",
        zip: "00000",
        latitude: 1.23,
        longitude: 4.56,
        timezone: "Europe/Oslo",
        utcoffset: "+02:00",
      },
    });
  };

  const result = await getIpInfo("2001:db8::1", {
    fetchImpl,
    ipApiBaseUrl: "https://example.test",
    timeoutMs: 100,
  });

  expect(calls[0]).toMatch(/^https:\/\/example\.test\/\?q=2001%3Adb8%3A%3A1$/);
  expect(result.status).toBe("success");
  expect(result.query).toBe("2001:db8::1");
  expect(result.countryCode).toBe("EX");
  expect(result.city).toBe("Sample City");
  expect(result.timezone).toBe("Europe/Oslo");
  expect(result.offset).toBe(7200);
  expect(result.isp).toBe("Example ISP");
  expect(result.as).toBe("AS64500 2001:db8::/32");
  expect(result.asname).toBe("Example LLC");
  expect(result.hosting).toBe(true);
  expect(result.vpn).toBe(true);
  expect(result.tor).toBe(false);
});

test("getIpInfo surfaces upstream errors", async () => {
  const fetchImpl: FetchLike = async () =>
    Response.json({ error: "Invalid IP Address or AS Number" });

  await expect(
    getIpInfo("nope", { fetchImpl, ipApiBaseUrl: "https://example.test", timeoutMs: 100 }),
  ).rejects.toThrow(/Invalid IP Address/);
});
