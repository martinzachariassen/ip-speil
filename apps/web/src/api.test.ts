import { afterEach, expect, test } from "bun:test";

import { fetchHeaders, fetchInfo } from "./api.ts";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(respond: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(respond(String(input), init))) as typeof fetch;
}

test("fetchInfo returns the payload when the proxy answers", async () => {
  stubFetch(() => Response.json({ status: "success", query: "203.0.113.10" }));

  const { info, error } = await fetchInfo();
  expect(error).toBeNull();
  expect(info.query).toBe("203.0.113.10");
});

test("fetchInfo reports throttling rather than a failed lookup", async () => {
  stubFetch(() => Response.json({ error: "rate_limited" }, { status: 429 }));

  const { info, error } = await fetchInfo();
  expect(error).toBe("rate_limited");
  // The 429 body must not be mistaken for an IpInfo.
  expect(info).toEqual({});
});

test("fetchInfo reports an upstream error separately from an unreachable service", async () => {
  stubFetch(() => Response.json({ error: "upstream_unreachable" }, { status: 502 }));
  expect((await fetchInfo()).error).toBe("unavailable");

  globalThis.fetch = (() => Promise.reject(new Error("network down"))) as typeof fetch;
  expect((await fetchInfo()).error).toBe("unreachable");
});

test("fetchInfo passes an explicit ip through, encoded", async () => {
  let seen = "";
  stubFetch((url) => {
    seen = url;
    return Response.json({ status: "success" });
  });

  await fetchInfo("2001:db8::1");
  expect(seen).toBe("/api/info?ip=2001%3Adb8%3A%3A1");
});

test("fetchInfo and fetchHeaders time out instead of hanging the scan", async () => {
  const signals: (AbortSignal | undefined | null)[] = [];
  stubFetch((_url, init) => {
    signals.push(init?.signal);
    return Response.json({});
  });

  await fetchInfo();
  await fetchHeaders();
  expect(signals).toHaveLength(2);
  expect(signals.every((s) => s instanceof AbortSignal)).toBe(true);
});

test("fetchHeaders degrades to an empty map on any failure", async () => {
  stubFetch(() => new Response("nope", { status: 500 }));
  expect(await fetchHeaders()).toEqual({});

  globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
  expect(await fetchHeaders()).toEqual({});
});
