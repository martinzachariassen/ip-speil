import { expect, test } from "bun:test";

import type { FetchLike } from "../src/lib/fetch.ts";
import { createRoutingLookup, networkBlock, normaliseRpki } from "../src/lib/routing.ts";

// A fake RIPEstat that dispatches by endpoint substring and records every URL.
function ripestat(routes: Record<string, unknown>, calls: string[] = []): FetchLike {
  return async (input) => {
    const url = String(input);
    calls.push(url);
    for (const [key, body] of Object.entries(routes)) {
      if (url.includes(key)) return new Response(JSON.stringify(body), { status: 200 });
    }
    return new Response("not found", { status: 404 });
  };
}

const OK_ROUTES = {
  "network-info": { data: { asns: ["15169"], prefix: "8.8.8.0/24" } },
  "rpki-validation": {
    data: {
      status: "valid",
      validating_roas: [
        { origin: "15169", prefix: "8.8.8.0/24", validity: "valid", max_length: 24 },
      ],
    },
  },
  "abuse-contact-finder": { data: { abuse_contacts: ["network-abuse@google.com"] } },
};

test("networkBlock zeroes host bits to a network block", () => {
  expect(networkBlock("203.0.113.55")).toBe("203.0.113.0/24");
  expect(networkBlock("2001:db8:1:2:3:4:5:6")).toBe("2001:db8:1::/48");
  expect(networkBlock("not-an-ip")).toBeNull();
});

test("createRoutingLookup chains network-info → rpki + abuse", async () => {
  const calls: string[] = [];
  const lookup = createRoutingLookup({ fetchImpl: ripestat(OK_ROUTES, calls) });

  const r = await lookup("8.8.8.8");

  expect(r?.prefix).toBe("8.8.8.0/24");
  expect(r?.originAsn).toBe("AS15169");
  expect(r?.rpki?.state).toBe("valid");
  expect(r?.abuseContacts).toEqual(["network-abuse@google.com"]);
  expect(r?.queried).toBe("8.8.8.0/24");
  // Only the truncated /24 is ever sent upstream — never the host address.
  expect(calls.every((u) => !u.includes("8.8.8.8") || u.includes("8.8.8.0"))).toBe(true);
  expect(calls.some((u) => u.includes("network-info") && u.includes("8.8.8.0%2F24"))).toBe(true);
});

test("createRoutingLookup caches by network block, not by host IP", async () => {
  const calls: string[] = [];
  const lookup = createRoutingLookup({ fetchImpl: ripestat(OK_ROUTES, calls) });

  await lookup("8.8.8.8");
  await lookup("8.8.8.200"); // same /24 → cache hit

  expect(calls.filter((u) => u.includes("network-info")).length).toBe(1);
});

test("createRoutingLookup degrades to undefined when RIPEstat fails", async () => {
  const failing: FetchLike = async () => new Response("err", { status: 500 });
  const lookup = createRoutingLookup({ fetchImpl: failing });

  expect(await lookup("8.8.8.8")).toBeUndefined();
});

test("normaliseRpki collapses unknown states and keeps ROAs", () => {
  expect(normaliseRpki({ data: { status: "invalid" } }).state).toBe("invalid");
  expect(normaliseRpki({ data: { status: "weird" } }).state).toBe("unknown");
  expect(normaliseRpki({ data: {} }).state).toBe("unknown");
  const withRoa = normaliseRpki({
    data: { status: "valid", validating_roas: [{ origin: "13335", prefix: "1.1.1.0/24" }] },
  });
  expect(withRoa.roas?.[0]?.origin).toBe("AS13335");
});
