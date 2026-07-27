import { timingSafeEqual } from "node:crypto";
import type { MiddlewareHandler } from "hono";

/**
 * Gate that proves a request came from our Cloudflare Worker.
 * The Worker attaches `Authorization: Bearer <PROXY_SECRET>` at the edge;
 * the secret never reaches the browser. No secret configured → no-op
 * (dev/test), so the suite stays offline and env-free.
 */
export function requireProxySecret(secret?: string): MiddlewareHandler {
  if (!secret) return async (_c, next) => next();

  const expected = Buffer.from(`Bearer ${secret}`);

  return async (c, next) => {
    const provided = Buffer.from(c.req.header("authorization") ?? "");
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return next();
    }
    return c.json({ error: "unauthorized" }, 401);
  };
}
