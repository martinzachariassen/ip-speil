import assert from "node:assert/strict";
import { test } from "node:test";

import { getClientIp, getIpInfo, isUnroutableIp } from "../src/ip-lookup.ts";

test("getClientIp prefers the first forwarded address", () => {
  assert.equal(
    getClientIp({
      "x-forwarded-for": "203.0.113.10, 198.51.100.20",
      "x-real-ip": "198.51.100.30",
    }),
    "203.0.113.10",
  );
});

test("getClientIp falls back to x-real-ip", () => {
  assert.equal(getClientIp({ "x-real-ip": "198.51.100.30" }), "198.51.100.30");
});

test("getClientIp falls back to the socket address when no proxy headers are present", () => {
  assert.equal(getClientIp({}, "203.0.113.50"), "203.0.113.50");
});

test("getClientIp strips the IPv6-mapped IPv4 prefix from the socket address", () => {
  assert.equal(getClientIp({}, "::ffff:203.0.113.50"), "203.0.113.50");
});

test("getClientIp collapses unroutable socket addresses to empty so upstream picks the source IP", () => {
  assert.equal(getClientIp({}, "::1"), "");
  assert.equal(getClientIp({}, "127.0.0.1"), "");
  assert.equal(getClientIp({}, "::ffff:127.0.0.1"), "");
  assert.equal(getClientIp({}, "192.168.1.42"), "");
});

test("getClientIp prefers x-forwarded-for over the socket address", () => {
  assert.equal(getClientIp({ "x-forwarded-for": "203.0.113.10" }, "::1"), "203.0.113.10");
});

test("getClientIp returns an empty string when nothing is available", () => {
  assert.equal(getClientIp({}), "");
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
    assert.equal(isUnroutableIp(ip), true, `expected ${ip} to be unroutable`);
  }
});

test("isUnroutableIp lets public addresses through", () => {
  for (const ip of ["203.0.113.10", "8.8.8.8", "172.15.0.1", "172.32.0.1", "2001:db8::1"]) {
    assert.equal(isUnroutableIp(ip), false, `expected ${ip} to be routable`);
  }
});

test("getIpInfo encodes the requested ip and normalises the response", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
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

  assert.match(calls[0], /^https:\/\/example\.test\/\?q=2001%3Adb8%3A%3A1$/);
  assert.equal(result.status, "success");
  assert.equal(result.query, "2001:db8::1");
  assert.equal(result.countryCode, "EX");
  assert.equal(result.city, "Sample City");
  assert.equal(result.timezone, "Europe/Oslo");
  assert.equal(result.offset, 7200);
  assert.equal(result.isp, "Example ISP");
  assert.equal(result.as, "AS64500 2001:db8::/32");
  assert.equal(result.asname, "Example LLC");
  assert.equal(result.hosting, true);
  assert.equal(result.vpn, true);
  assert.equal(result.tor, false);
});

test("getIpInfo surfaces upstream errors", async () => {
  const fetchImpl = async () => Response.json({ error: "Invalid IP Address or AS Number" });

  await assert.rejects(
    () => getIpInfo("nope", { fetchImpl, ipApiBaseUrl: "https://example.test", timeoutMs: 100 }),
    /Invalid IP Address/,
  );
});
