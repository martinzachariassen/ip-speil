import { expect, test } from "bun:test";

import { createCachedFetcher, TtlCache } from "../src/lib/cache.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("TtlCache returns a value within its ttl and expires it afterwards", async () => {
  const cache = new TtlCache<string>(20);
  cache.set("k", "v");
  expect(cache.get("k")).toBe("v");

  await sleep(40);
  expect(cache.get("k")).toBeUndefined();
});

test("createCachedFetcher serves a cached value without reloading", async () => {
  let loads = 0;
  const fetcher = createCachedFetcher<number>({ ttlMs: 60_000 });
  const load = async () => {
    loads += 1;
    return 42;
  };

  expect(await fetcher("k", load)).toBe(42);
  expect(await fetcher("k", load)).toBe(42);
  expect(loads).toBe(1);
});

test("createCachedFetcher coalesces concurrent loads for the same key", async () => {
  let loads = 0;
  const fetcher = createCachedFetcher<number>({ ttlMs: 60_000 });
  const load = async () => {
    loads += 1;
    await Promise.resolve();
    return 7;
  };

  const [a, b] = await Promise.all([fetcher("k", load), fetcher("k", load)]);
  expect(a).toBe(7);
  expect(b).toBe(7);
  expect(loads).toBe(1);
});

test("createCachedFetcher reloads after the ttl lapses", async () => {
  let loads = 0;
  const fetcher = createCachedFetcher<number>({ ttlMs: 10 });
  const load = async () => {
    loads += 1;
    return loads;
  };

  expect(await fetcher("k", load)).toBe(1);
  await sleep(25);
  expect(await fetcher("k", load)).toBe(2);
});

test("TtlCache never holds more than maxEntries, even with nothing expired", () => {
  const cache = new TtlCache<number>(60_000, 10);
  for (let i = 0; i < 1000; i++) cache.set(`k${i}`, i);

  expect(cache.size).toBeLessThanOrEqual(10);
  // The most recent writes survive; the oldest were evicted to make room.
  expect(cache.get("k999")).toBe(999);
  expect(cache.get("k0")).toBeUndefined();
});

test("TtlCache reclaims expired entries when it reaches its ceiling", async () => {
  const cache = new TtlCache<string>(60, 3);
  cache.set("a", "1");
  cache.set("b", "2");
  await sleep(100);

  // Both are past their ttl but still occupy the map until something sweeps.
  cache.set("c", "3");
  expect(cache.size).toBe(3);

  // Hitting the ceiling reclaims "a" and "b" together, so "c" is not evicted
  // to make room for "d".
  cache.set("d", "4");
  expect(cache.size).toBe(2);
  expect(cache.get("c")).toBe("3");
  expect(cache.get("a")).toBeUndefined();
});

test("TtlCache re-writing a key keeps it from ageing out", () => {
  const cache = new TtlCache<number>(60_000, 3);
  cache.set("keep", 1);
  cache.set("a", 2);
  cache.set("keep", 3);
  cache.set("b", 4);
  cache.set("c", 5);

  expect(cache.get("keep")).toBe(3);
  expect(cache.get("a")).toBeUndefined();
});

test("TtlCache drops an expired entry on read", async () => {
  const cache = new TtlCache<string>(20, 10);
  cache.set("k", "v");
  await sleep(40);

  expect(cache.get("k")).toBeUndefined();
  expect(cache.size).toBe(0);
});
