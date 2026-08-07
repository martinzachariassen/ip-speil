import { expect, test } from "bun:test";

import type { LocalGeo } from "../src/geoip/store.ts";
import { getClientIp, isProbablyIp, isUnroutableIp } from "../src/lib/client-ip.ts";
import { getIpInfo } from "../src/lib/ip-lookup.ts";

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

test("getIpInfo maps a local dataset lookup into IpInfo (no network)", async () => {
  const geoLookup = (ip: string): LocalGeo | null =>
    ip === "2001:db8::1"
      ? {
          countryCode: "EX",
          country: "Examplestan",
          region: "Sample State",
          city: "Sample City",
          lat: 1.23,
          lon: 4.56,
          asn: 64500,
          asName: "Example LLC",
          org: "Example LLC",
          asnCountry: "EX",
        }
      : null;

  const result = await getIpInfo("2001:db8::1", { geoLookup, isTorExit: () => false });

  expect(result.status).toBe("success");
  expect(result.query).toBe("2001:db8::1");
  expect(result.country).toBe("Examplestan");
  expect(result.countryCode).toBe("EX");
  expect(result.city).toBe("Sample City");
  expect(result.lat).toBe(1.23);
  expect(result.as).toBe("AS64500");
  expect(result.asname).toBe("Example LLC");
  expect(result.isp).toBe("Example LLC");
  // Not derivable from local data → left undefined, never fabricated.
  expect(result.vpn).toBeUndefined();
  expect(result.proxy).toBeUndefined();
});

test("getIpInfo marks Tor exits and infers hosting from the ASN org", async () => {
  const geoLookup = (): LocalGeo => ({
    countryCode: "US",
    asnCountry: "US",
    asn: 16509,
    org: "Amazon.com, Inc.",
    asName: "AMAZON-02",
  });

  const result = await getIpInfo("52.0.0.1", { geoLookup, isTorExit: (ip) => ip === "52.0.0.1" });

  expect(result.hosting).toBe(true);
  expect(result.tor).toBe(true);
});

test("getIpInfo returns fail for an invalid ip and never touches the dataset", async () => {
  let called = false;
  const result = await getIpInfo("not-an-ip", {
    geoLookup: () => {
      called = true;
      return null;
    },
  });

  expect(result.status).toBe("fail");
  expect(called).toBe(false);
});

test("getIpInfo returns success with limited data for an ip absent from the dataset", async () => {
  const result = await getIpInfo("198.51.100.7", { geoLookup: () => null });

  expect(result.status).toBe("success");
  expect(result.query).toBe("198.51.100.7");
  expect(result.countryCode).toBeUndefined();
  expect(result.hosting).toBeUndefined();
});

test("getIpInfo flags private addresses as bogon", async () => {
  const result = await getIpInfo("192.168.1.5", { geoLookup: () => null });
  expect(result.bogon).toBe(true);
});
