import assert from "node:assert/strict";
import { test } from "node:test";

import { getClientIp, getIpInfo } from "../src/ip-api.ts";

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

test("getIpInfo encodes the requested ip and returns successful json", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return Response.json({ status: "success", query: "2001:db8::1" });
  };

  const result = await getIpInfo("2001:db8::1", {
    fetchImpl,
    ipApiBaseUrl: "http://example.test",
    timeoutMs: 100,
  });

  assert.deepEqual(result, { status: "success", query: "2001:db8::1" });
  assert.match(calls[0], /^http:\/\/example\.test\/json\/2001%3Adb8%3A%3A1\?/);
});
