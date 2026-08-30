import { afterEach, expect, test } from "bun:test";

import type { Env } from "./index.ts";
import { proxyInfo } from "./proxy.ts";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

const env = {
  API_ORIGIN: "https://api.ip.mlz.no",
  PROXY_SECRET: "edge-token-abc",
} as unknown as Env;

interface Seen {
  url: string;
  headers: Headers;
}

function stubUpstream(respond: () => Response | Promise<Response>) {
  const seen: Seen[] = [];
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) => {
    seen.push({ url: String(input), headers: new Headers(init?.headers) });
    return Promise.resolve(respond());
  }) as typeof fetch;
  return seen;
}

test("attaches the bearer secret and the visitor's real IP", async () => {
  const seen = stubUpstream(() => Response.json({ status: "success" }));

  await proxyInfo(
    new Request("https://ip.mlz.no/api/info", {
      headers: { "cf-connecting-ip": "203.0.113.10" },
    }),
    env,
  );

  expect(seen).toHaveLength(1);
  expect(seen[0]?.url).toBe("https://api.ip.mlz.no/api/info");
  expect(seen[0]?.headers.get("authorization")).toBe("Bearer edge-token-abc");
  // The API's per-IP limiter keys on this, so it has to be the visitor's.
  expect(seen[0]?.headers.get("x-forwarded-for")).toBe("203.0.113.10");
});

test("forwards the query string so an explicit ?ip= still works", async () => {
  const seen = stubUpstream(() => Response.json({}));

  await proxyInfo(new Request("https://ip.mlz.no/api/info?ip=1.1.1.1"), env);

  expect(seen[0]?.url).toBe("https://api.ip.mlz.no/api/info?ip=1.1.1.1");
});

test("the secret never reaches the browser", async () => {
  stubUpstream(() => Response.json({ status: "success" }));

  const res = await proxyInfo(new Request("https://ip.mlz.no/api/info"), env);
  const headers = [...res.headers].map(([k, v]) => `${k}: ${v}`).join("\n");

  expect(headers).not.toContain("edge-token-abc");
  expect(await res.text()).not.toContain("edge-token-abc");
});

test("passes the upstream status through and never caches it", async () => {
  stubUpstream(() => Response.json({ error: "rate_limited" }, { status: 429 }));

  const res = await proxyInfo(new Request("https://ip.mlz.no/api/info"), env);

  expect(res.status).toBe(429);
  expect(res.headers.get("cache-control")).toBe("no-store");
  expect(await res.json()).toEqual({ error: "rate_limited" });
});

// Without this the runtime answers with an opaque "internal error; reference =
// …" 500, which says nothing about which side broke.
test("an unreachable API is a clean 502, not a worker crash", async () => {
  globalThis.fetch = (() => Promise.reject(new Error("connection refused"))) as typeof fetch;

  const res = await proxyInfo(new Request("https://ip.mlz.no/api/info"), env);

  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({
    error: "upstream_unreachable",
    detail: "https://api.ip.mlz.no did not respond",
  });
});
