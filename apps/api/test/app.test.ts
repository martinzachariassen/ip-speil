import { expect, test } from "bun:test";
import { createApp } from "../src/app.ts";
import type { LocalGeo } from "../src/geoip/store.ts";

// A fake local dataset so the route tests stay fully offline.
const geoLookupImpl = (ip: string): LocalGeo | null => {
  if (ip === "203.0.113.10") {
    return {
      countryCode: "NO",
      country: "Norway",
      region: "Oslo",
      city: "Oslo",
      asn: 2119,
      asName: "Telenor",
      org: "Telenor",
      asnCountry: "NO",
    };
  }
  if (ip === "2001:db8::42") {
    return { countryCode: "NO", country: "Norway", asnCountry: "NO", asn: 2119, org: "Telenor" };
  }
  if (ip === "203.0.113.99") return { countryCode: "NO" };
  return null;
};

// Enrichment does real DNS work by default; inject no-op impls so the core route
// tests stay network-free. Geo comes from the injected local lookup, not upstream.
const app = (options: Parameters<typeof createApp>[0] = {}) =>
  createApp({
    requestTimeoutMs: 100,
    reverseDnsImpl: async () => undefined,
    blocklistImpl: async () => [],
    enableGeoCrossCheck: false,
    isTorExit: () => false,
    geoLookupImpl,
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

test("api info uses the first forwarded ip and returns local geo", async () => {
  const res = await app().request("/api/info", {
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
  expect(body.as).toBe("AS2119");
});

test("api info caches repeat lookups for the same ip", async () => {
  let calls = 0;
  const counting = (): LocalGeo => {
    calls += 1;
    return { countryCode: "NO" };
  };
  const server = app({ geoLookupImpl: counting });
  const headers = { "x-forwarded-for": "203.0.113.10" };

  await server.request("/api/info", { headers });
  await server.request("/api/info", { headers });

  expect(calls).toBe(1);
});

test("api info enriches with reverse dns, blocklists, and a two-source geo cross-check", async () => {
  const server = createApp({
    requestTimeoutMs: 100,
    reverseDnsImpl: async () => "host.example.no",
    blocklistImpl: async () => ["Spamhaus ZEN"],
    enableGeoCrossCheck: true,
    isTorExit: () => false,
    geoLookupImpl: () => ({
      countryCode: "NO",
      country: "Norway",
      city: "Oslo",
      asn: 2119,
      asnCountry: "NO",
      org: "Telenor",
      asName: "Telenor",
    }),
  });

  const res = await server.request("/api/info", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });
  const body = (await res.json()) as Record<string, unknown>;

  expect(res.status).toBe(200);
  expect(body.reverse).toBe("host.example.no");
  expect(body.blocklists).toEqual(["Spamhaus ZEN"]);
  const geo = body.geo as { agree: number; total: number };
  expect(geo.total).toBe(2);
  expect(geo.agree).toBe(2);
});

test("api info looks up an explicit ip query", async () => {
  const res = await app().request("/api/info?ip=2001%3Adb8%3A%3A42", {
    headers: { "x-forwarded-for": "203.0.113.10" },
  });

  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  expect(body.query).toBe("2001:db8::42");
  expect(body.countryCode).toBe("NO");
});

test("api info rejects a syntactically invalid ip with 400", async () => {
  let called = false;
  const server = app({
    geoLookupImpl: () => {
      called = true;
      return null;
    },
  });

  const res = await server.request("/api/info?ip=not-an-ip");

  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "invalid_ip" });
  expect(called).toBe(false);
});

test("api info returns success with limited data for an ip absent from the dataset", async () => {
  const res = await app().request("/api/info", {
    headers: { "x-forwarded-for": "198.51.100.7" },
  });

  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  expect(body.status).toBe("success");
  expect(body.query).toBe("198.51.100.7");
  expect(body.countryCode).toBeUndefined();
});

test("api info rate limits a client after the configured number of requests", async () => {
  const server = app({ infoRateLimit: 2 });
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
  const server = app({ proxySecret: "edge-token-abc" });

  const missing = await server.request("/api/info");
  expect(missing.status).toBe(401);
  expect(await missing.json()).toEqual({ error: "unauthorized" });

  const wrong = await server.request("/api/info", {
    headers: { authorization: "Bearer nope" },
  });
  expect(wrong.status).toBe(401);
});

test("api info accepts calls carrying the matching proxy token", async () => {
  const server = app({ proxySecret: "edge-token-abc" });

  const res = await server.request("/api/info", {
    headers: { authorization: "Bearer edge-token-abc", "x-forwarded-for": "203.0.113.10" },
  });

  expect(res.status).toBe(200);
  const body = (await res.json()) as Record<string, unknown>;
  expect(body.query).toBe("203.0.113.10");
});
