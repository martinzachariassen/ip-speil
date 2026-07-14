import type { Context, Handler } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { CACHE_CONTROL, UMAMI_SCRIPT_CACHE_MS } from "../config.ts";
import { createSingleFlight } from "../lib/cache.ts";
import type { FetchLike } from "../lib/fetch.ts";

export interface UmamiRouteDeps {
  fetchImpl: FetchLike;
  scriptUrl: string;
  sendUrl: string;
  requestTimeoutMs: number;
  clientIpFor: (c: Context) => string;
}

interface ScriptCache {
  body: ArrayBuffer;
  fetchedAt: number;
  contentType: string;
}

export function umamiRoutes(deps: UmamiRouteDeps): { script: Handler; send: Handler } {
  let scriptCache: ScriptCache | null = null;
  const flight = createSingleFlight<ScriptCache>();

  const script: Handler = async (c) => {
    try {
      if (!scriptCache || Date.now() - scriptCache.fetchedAt > UMAMI_SCRIPT_CACHE_MS) {
        scriptCache = await flight("script", async () => {
          const upstream = await deps.fetchImpl(deps.scriptUrl, {
            signal: AbortSignal.timeout(deps.requestTimeoutMs),
          });
          if (!upstream.ok) throw new Error("umami script fetch failed");
          return {
            body: await upstream.arrayBuffer(),
            fetchedAt: Date.now(),
            contentType: upstream.headers.get("content-type") ?? "text/javascript; charset=utf-8",
          };
        });
      }
      c.header("Content-Type", scriptCache.contentType);
      c.header("Cache-Control", CACHE_CONTROL.script);
      return c.body(scriptCache.body);
    } catch {
      return c.text("umami script fetch failed", 502);
    }
  };

  const send: Handler = async (c) => {
    try {
      const body = await c.req.arrayBuffer();
      const headers: Record<string, string> = {
        "Content-Type": c.req.header("content-type") ?? "application/json",
      };
      const ua = c.req.header("user-agent");
      if (ua) headers["User-Agent"] = ua;
      const clientIp = deps.clientIpFor(c);
      if (clientIp) headers["X-Forwarded-For"] = clientIp;

      const upstream = await deps.fetchImpl(deps.sendUrl, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(deps.requestTimeoutMs),
      });
      c.header(
        "Content-Type",
        upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
      );
      c.header("Cache-Control", CACHE_CONTROL.noStore);
      return c.body(await upstream.arrayBuffer(), upstream.status as ContentfulStatusCode);
    } catch {
      return c.json({ error: "umami_send_failed" }, 502);
    }
  };

  return { script, send };
}
