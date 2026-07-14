import { expect, test } from "bun:test";

import {
  BudgetExhaustedError,
  createCachedFetcher,
  DailyBudget,
  TtlCache,
} from "../../src/server/lib/cache.ts";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test("TtlCache expires entries after the ttl but keeps them for stale reads", async () => {
  const cache = new TtlCache<string>(20);
  cache.set("k", "v");
  expect(cache.get("k")).toBe("v");

  await sleep(40);
  expect(cache.get("k")).toBeUndefined();
  expect(cache.getStale("k")).toBe("v");
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

test("DailyBudget blocks loads past the cap and throws when nothing is cached", async () => {
  const budget = new DailyBudget(1);
  const fetcher = createCachedFetcher<number>({ ttlMs: 60_000, budget });

  expect(await fetcher("a", async () => 1)).toBe(1);
  await expect(fetcher("b", async () => 2)).rejects.toBeInstanceOf(BudgetExhaustedError);
});

test("createCachedFetcher serves a stale value once the budget is spent", async () => {
  const budget = new DailyBudget(1);
  const fetcher = createCachedFetcher<number>({ ttlMs: 10, budget });

  expect(await fetcher("a", async () => 10)).toBe(10);
  await sleep(25);
  expect(await fetcher("a", async () => 999)).toBe(10);
});
