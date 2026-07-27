import { expect, test } from "bun:test";

import { createApp } from "../src/app.ts";
import type { FetchLike } from "../src/lib/ip-lookup.ts";

// Enrichment does real DNS + secondary-provider calls; default it off so the
// core route tests stay network-free. Enrichment is covered separately below.
const app = (options: Parameters<typeof createApp>[0] = {}) =>
  createApp({
    requestTimeoutMs: 100,
    reverseDnsImpl: async () => undefined,
    blocklistImpl: async () => [],
    enableGeoCrossCheck: false,
    ...options,
  });

test("health endpoint returns ok with security headers", async () => {
  const res = await app().request("/health");

  expect(res.status).toBe(200);
  expect(await res.text()).toBe("ok");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  expect(res.headers.get("strict-transport-security")).toContain("max-age=63072000");
});

test("does not serve unknown paths", async () => {
  const res = await app().request("/secret.txt");

  expect(res.status).toBe(404);
  expect(await res.text()).toBe("Not found");
});

test("rejects unsupported methods on known paths", async () => {
  const res = await app().request("/health", { method: "POST" });

  expect(res.status).toBe(404);
});

test("api info uses the first forwarded ip and returns normalised json", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(String(url));
    return Response.json({
      ip: "203.0.113.10",
      location: { country: "Norway", country_code: "NO" },
      company: { name: "Telenor" },
      asn: { asn: 2119, org: "Telenor" },
    });
  };

  const res = await app({ fetchImpl }).request("/api/info", {
    headers: { "x-forwarded-for": "203.0.113.10, 198.51.100.20" },
  });

  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(res.headers.get("access-control-allow-origin")).toBeNull();
  const body = (await res.json()) as Record<string, unknown>;
  expect(body.status).toBe("success");
  expect(body.query).toBe("203.0.113.10");
  expect(body.country).toBe("Norway");
  expect(body.countryCode).toBe("NO");
  expect(body.isp).toBe("Telenor");
  expect(calls[0]).toMatch(/\?q=203\.0\.113\.10$/);
});

test("api info caches repeat lookups for the same ip", async () => {
  let calls = 0;
  const fetchImpl: FetchLike = async () => {
    calls += 1;
    return Response.json({ ip: "203.0.113.10", location: { country_code: "NO" } });
  };
  const server = app({ fetchImpl });
  const headers = { "x-forwarded-for": "203.0.113.10" };

  await server.request("/api/info", { headers });
  await server.request("/api/info", { headers });

  expect(calls).toBe(1);
});

test("api info enriches with reverse dns, blocklists, and a geo cross-check", async () => {
  const fetchImpl: FetchLike = async (url) => {
    const u = String(url);
    if (u.startsWith("https://ipwho.is/")) {
      return Response.json({ success: true, country_code: "NO", city: "Oslo" });
    }
    if (u.startsWith("https://get.geojs.io/")) {
      return Response.json({ country_code: "NO", city: "Oslo" });
    }
    return Response.json({
      ip: "203.0.113.10",
      location: { country: "Norway", country_code: "NO", city: "Oslo" },
      asn: { asn: 2119, org: "Telenor" },
    });
  };

  const server = createApp({
    requestTimeoutMs: 100,
    fetchImpl,
    reverseDnsImpl: async () => "host.example.no",
    blocklistImpl: async () => ["Spamhaus ZEN"],
    enableGeoCrossCheck: true,
  });

  const res = await server.request("/api/info", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
  const body = (await res.json()) as Record<string, unknown>;

  expect(res.status).toBe(200);
  expect(body.reverse).toBe("host.example.no");
  expect(body.blocklists).toEqual(["Spamhaus ZEN"]);
  const geo = body.geo as { agree: number; total: number };
  expect(geo.total).toBe(3);
  expect(geo.agree).toBe(3);
});

test("api info looks up an explicit ip query", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(String(url));
    return Response.json({
      ip: "2001:db8::42",
      location: { country: "Norway", country_code: "NO" },
    });
  };

  const res = await app({ fetchImpl }).request("/api/info?ip=2001%3Adb8%3A%3A42", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });

  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  expect(body.query).toBe("2001:db8::42");
  expect(calls[0]).toMatch(/\?q=2001%3Adb8%3A%3A42$/);
});

test("api info rejects a syntactically invalid ip with 400", async () => {
  let called = false;
  const fetchImpl: FetchLike = async () => {
    called = true;
    return Response.json({});
  };

  const res = await app({ fetchImpl }).request("/api/info?ip=not-an-ip");

  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "invalid_ip" });
  expect(called).toBe(false);
});

test("api info reports failed upstream lookups as bad gateway", async () => {
  const fetchImpl: FetchLike = async () =>
    Response.json({ error: "Invalid IP Address or AS Number" });

  const res = await app({ fetchImpl }).request("/api/info");
  const body = (await res.json()) as Record<string, unknown>;

  expect(res.status).toBe(502);
  expect(body.error).toBe("upstream_failed");
  expect(body.message).toMatch(/Invalid IP Address/);
});

test("api info rate limits a client after the configured number of requests", async () => {
  const fetchImpl: FetchLike = async () => Response.json({ ip: "203.0.113.10" });
  const server = app({ fetchImpl, infoRateLimit: 2 });
  const headers = { "x-forwarded-for": "203.0.113.99" };

  const first = await server.request("/api/info", { headers });
  const second = await server.request("/api/info", { headers });
  const third = await server.request("/api/info", { headers });

  expect(first.status).toBe(200);
  expect(second.status).toBe(200);
  expect(third.status).toBe(429);
  expect(third.headers.get("retry-after")).not.toBeNull();
  expect(await third.json()).toEqual({ error: "rate_limited" });
});

test("api info rejects calls without the proxy token when one is configured", async () => {
  const fetchImpl: FetchLike = async () => Response.json({ ip: "203.0.113.10" });
  const server = app({ fetchImpl, proxySecret: "edge-token-abc" });

  const missing = await server.request("/api/info");
  expect(missing.status).toBe(401);
  expect(await missing.json()).toEqual({ error: "unauthorized" });

  const wrong = await server.request("/api/info", {
    headers: { authorization: "Bearer nope" },
  });
  expect(wrong.status).toBe(401);
});

test("api info accepts calls carrying the matching proxy token", async () => {
  const fetchImpl: FetchLike = async () =>
    Response.json({ ip: "203.0.113.10", location: { country_code: "NO" } });
  const server = app({ fetchImpl, proxySecret: "edge-token-abc" });

  const res = await server.request("/api/info", {
    headers: { authorization: "Bearer edge-token-abc", "x-forwarded-for": "203.0.113.10" },
  });

  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  expect(body.query).toBe("203.0.113.10");
});
