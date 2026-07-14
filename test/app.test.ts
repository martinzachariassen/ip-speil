import { beforeAll, expect, test } from "bun:test";

import { createApp } from "../src/app.ts";
import type { FetchLike } from "../src/ip-lookup.ts";

// The client bundle is a build artifact; build it once so the static-serving
// test has something to serve.
beforeAll(async () => {
  await Bun.build({
    entrypoints: ["src/client/main.ts"],
    outdir: "public/assets/js",
    target: "browser",
  });
});

const app = (options: Parameters<typeof createApp>[0] = {}) =>
  createApp({ requestTimeoutMs: 100, ...options });

test("health endpoint returns ok with security headers", async () => {
  const res = await app().request("/health");

  expect(res.status).toBe(200);
  expect(await res.text()).toBe("ok");
  expect(res.headers.get("content-security-policy")).not.toContain("unsafe-inline");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  expect(res.headers.get("strict-transport-security")).toContain("max-age=63072000");
});

test("serves the index and built assets with appropriate cache headers", async () => {
  const server = app();
  const index = await server.request("/");
  const mainJs = await server.request("/assets/js/main.js");
  const css = await server.request("/assets/css/styles.css");

  expect(index.status).toBe(200);
  expect(index.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(index.headers.get("cache-control")).toBe("no-store");
  expect(await index.text()).toMatch(
    /<script type="module" src="\/assets\/js\/main\.js"><\/script>/,
  );

  expect(mainJs.status).toBe(200);
  expect(mainJs.headers.get("content-type")).toBe("text/javascript; charset=utf-8");
  expect(mainJs.headers.get("cache-control")).toBe("public, max-age=300");

  expect(css.status).toBe(200);
  expect(css.headers.get("content-type")).toBe("text/css; charset=utf-8");
  expect(css.headers.get("cache-control")).toBe("public, max-age=300");
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
  expect(res.headers.get("access-control-allow-origin")).toBe("*");
  const body = (await res.json()) as Record<string, unknown>;
  expect(body.status).toBe("success");
  expect(body.query).toBe("203.0.113.10");
  expect(body.country).toBe("Norway");
  expect(body.countryCode).toBe("NO");
  expect(body.isp).toBe("Telenor");
  expect(calls[0]).toMatch(/\?q=203\.0\.113\.10$/);
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

test("headers endpoint hides hop-by-hop headers", async () => {
  const res = await app().request("/api/headers", {
    headers: { "x-visible": "yes", "x-real-ip": "203.0.113.10" },
  });
  const body = (await res.json()) as Record<string, unknown>;

  expect(res.status).toBe(200);
  expect(body["x-visible"]).toBe("yes");
  expect(body.host).toBeUndefined();
  expect(body.connection).toBeUndefined();
});

test("script.js proxies the umami tracker as a first-party asset", async () => {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(String(url));
    return new Response("(()=>{/* umami */})();", {
      headers: { "content-type": "application/javascript; charset=utf-8" },
    });
  };

  const res = await app({ fetchImpl, umamiScriptUrl: "https://example.test/script.js" }).request(
    "/script.js",
  );

  expect(res.status).toBe(200);
  expect(res.headers.get("content-type")).toBe("application/javascript; charset=utf-8");
  expect(res.headers.get("cache-control")).toBe("public, max-age=3600");
  expect(await res.text()).toMatch(/umami/);
  expect(calls).toEqual(["https://example.test/script.js"]);
});

test("api/send forwards the body and propagates the client IP to umami", async () => {
  const calls: { url: string; method?: string; body: string; headers: Record<string, string> }[] =
    [];
  const fetchImpl: FetchLike = async (url, init) => {
    const raw = init?.body;
    const body = raw ? new TextDecoder().decode(raw as ArrayBuffer) : "";
    calls.push({
      url: String(url),
      method: init?.method,
      body,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response('{"ok":true}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const payload = JSON.stringify({ type: "event", payload: { website: "abc" } });
  const res = await app({ fetchImpl, umamiSendUrl: "https://example.test/api/send" }).request(
    "/api/send",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 test",
        "x-forwarded-for": "203.0.113.10",
      },
      body: payload,
    },
  );

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect(calls).toHaveLength(1);
  expect(calls[0]?.url).toBe("https://example.test/api/send");
  expect(calls[0]?.method).toBe("POST");
  expect(calls[0]?.body).toBe(payload);
  expect(calls[0]?.headers["User-Agent"]).toBe("Mozilla/5.0 test");
  expect(calls[0]?.headers["X-Forwarded-For"]).toBe("203.0.113.10");
});

test("api/send rejects an oversized body with 413", async () => {
  let called = false;
  const fetchImpl: FetchLike = async () => {
    called = true;
    return new Response("{}");
  };

  const res = await app({ fetchImpl }).request("/api/send", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "x".repeat(70 * 1024),
  });

  expect(res.status).toBe(413);
  expect(await res.json()).toEqual({ error: "payload_too_large" });
  expect(called).toBe(false);
});

test("api/send rate limits a client after the configured number of requests", async () => {
  let calls = 0;
  const fetchImpl: FetchLike = async () => {
    calls += 1;
    return new Response('{"ok":true}', { headers: { "content-type": "application/json" } });
  };
  const server = app({
    fetchImpl,
    sendRateLimit: 1,
    umamiSendUrl: "https://example.test/api/send",
  });
  const req = () =>
    server.request("/api/send", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.77" },
      body: JSON.stringify({ type: "event" }),
    });

  const first = await req();
  const second = await req();

  expect(first.status).toBe(200);
  expect(second.status).toBe(429);
  expect(await second.json()).toEqual({ error: "rate_limited" });
  expect(calls).toBe(1);
});
