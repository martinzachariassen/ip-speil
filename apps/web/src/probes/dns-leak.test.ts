import { afterEach, expect, test } from "bun:test";

import { getDnsLeak } from "./dns-leak.ts";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

// A response whose headers arrived but whose body fails mid-read.
function brokenBody(): Response {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.error(new Error("connection reset"));
      },
    }),
  );
}

function stubFetch(respond: (url: string) => Response | Promise<Response>) {
  const calls: string[] = [];
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = String(input);
    calls.push(url);
    return Promise.resolve(respond(url));
  }) as typeof fetch;
  return calls;
}

test("reports the resolvers the reflection test saw", async () => {
  stubFetch((url) => {
    if (url.endsWith("/id")) return new Response("abc123\n");
    if (url.includes("/dnsleak/test/")) {
      return Response.json([
        { type: "ip", ip: "203.0.113.10" },
        { type: "dns", ip: "1.1.1.1", country_name: "Australia", asn: "AS13335" },
        { type: "dns", ip: "1.1.1.1", country_name: "Australia", asn: "AS13335" },
        { type: "dns", ip: "8.8.8.8", country_name: "United States", asn: "AS15169" },
        { type: "conclusion", ip: "You use 2 DNS servers" },
      ]);
    }
    return new Response("", { status: 200 });
  });

  const result = await getDnsLeak();
  expect(result.available).toBe(true);
  expect(result.source).toBe("bash.ws");
  expect(result.resolvers.map((r) => r.ip)).toEqual(["1.1.1.1", "8.8.8.8"]);
  expect(result.conclusion).toBe("You use 2 DNS servers");
});

test("a body that fails mid-read degrades instead of throwing", async () => {
  stubFetch((url) => (url.endsWith("/id") ? brokenBody() : new Response("")));

  // Before the guard this rejected, and the rejection escaped the whole scan.
  const result = await getDnsLeak();
  expect(result).toEqual({ available: false, resolvers: [] });
});

test("an unusable id is not turned into a lookup", async () => {
  const calls = stubFetch(() => new Response("<html>maintenance</html>"));

  const result = await getDnsLeak();
  expect(result.available).toBe(false);
  expect(calls.some((url) => url.includes("/dnsleak/test/"))).toBe(false);
});

test("a failing endpoint is retried once, not hammered in the same tick", async () => {
  const calls = stubFetch(() => new Response("nope", { status: 503 }));

  const started = Date.now();
  const result = await getDnsLeak();

  expect(result.available).toBe(false);
  expect(calls.filter((url) => url.endsWith("/id"))).toHaveLength(2);
  // The second attempt waits — retrying microseconds later re-hits whatever failed.
  expect(Date.now() - started).toBeGreaterThanOrEqual(250);
});

test("a malformed payload degrades rather than throwing", async () => {
  stubFetch((url) => {
    if (url.endsWith("/id")) return new Response("abc123");
    if (url.includes("/dnsleak/test/")) return new Response("not json at all");
    return new Response("");
  });

  expect(await getDnsLeak()).toEqual({ available: false, resolvers: [] });
});
