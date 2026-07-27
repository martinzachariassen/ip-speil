import type { Context, MiddlewareHandler } from "hono";

export interface RateLimitOptions {
  windowMs: number;
  limit: number;
  keyGenerator: (c: Context) => string;
  // The cross-IP backstop shares a route with the per-IP limiter; only one of
  // them should emit the standard RateLimit-* headers.
  standardHeaders?: boolean;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const CLEANUP_THRESHOLD = 10_000;

// In-memory fixed-window limiter. Single-instance by design — ip-speil runs as
// one Railway replica, so a shared store would be overkill. Its job is to shrug
// off casual abuse; the real upstream-quota guard is the daily budget in cache.ts.
export function rateLimit({
  windowMs,
  limit,
  keyGenerator,
  standardHeaders = true,
}: RateLimitOptions): MiddlewareHandler {
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

    if (buckets.size > CLEANUP_THRESHOLD) {
      for (const [k, b] of buckets) {
        if (now >= b.resetAt) buckets.delete(k);
      }
    }

    const resetSeconds = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));
    if (standardHeaders) {
      c.header("RateLimit-Limit", String(limit));
      c.header("RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
      c.header("RateLimit-Reset", String(resetSeconds));
    }

    if (bucket.count > limit) {
      c.header("Retry-After", String(resetSeconds));
      return c.json({ error: "rate_limited" }, 429);
    }

    await next();
  };
}
