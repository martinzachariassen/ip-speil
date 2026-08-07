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
