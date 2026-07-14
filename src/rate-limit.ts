import type { Context, MiddlewareHandler } from "hono";

export interface RateLimitOptions {
  /** Fixed window length in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed per key within a window. */
  limit: number;
  /** Derives the bucket key for a request — usually the client IP. */
  keyGenerator: (c: Context) => string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/** Buckets are pruned lazily once the map grows past this many keys. */
const CLEANUP_THRESHOLD = 10_000;

/**
 * Small in-memory fixed-window rate limiter as Hono middleware. Kept dependency
 * free and single-instance — ip-speil runs as one Railway replica, so a shared
 * store (Redis) would be overkill. Its main job is to protect the ipapi.is
 * free-tier quota (1k req/day) and shrug off casual abuse, not to be a WAF.
 */
export function rateLimit({ windowMs, limit, keyGenerator }: RateLimitOptions): MiddlewareHandler {
  const buckets = new Map<string, Bucket>();

  return async (c, next) => {
    const now = Date.now();
    const key = keyGenerator(c);

    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    // Opportunistic cleanup so a churn of unique keys can't grow the map forever.
    if (buckets.size > CLEANUP_THRESHOLD) {
      for (const [k, b] of buckets) {
        if (now >= b.resetAt) buckets.delete(k);
      }
    }

    const resetSeconds = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));
    c.header("RateLimit-Limit", String(limit));
    c.header("RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    c.header("RateLimit-Reset", String(resetSeconds));

    if (bucket.count > limit) {
      c.header("Retry-After", String(resetSeconds));
      return c.json({ error: "rate_limited" }, 429);
    }

    await next();
  };
}
