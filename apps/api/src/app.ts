import type { Context } from "hono";
import { Hono } from "hono";
import { getConnInfo } from "hono/bun";

import { requireProxySecret } from "./auth.ts";
import { ENABLE_ONLINE_TIEBREAKER, RATE_LIMIT, REQUEST_TIMEOUT_MS, UPSTREAM } from "./config.ts";
import type { LocalGeo } from "./geoip/store.ts";
import { getClientIp } from "./lib/client-ip.ts";
import { createEnricher } from "./lib/enrich.ts";
import type { FetchLike } from "./lib/fetch.ts";
import { createIpService } from "./lib/ip-service.ts";
import { isTorExit as defaultIsTorExit } from "./lib/tor.ts";
import { rateLimit } from "./rate-limit.ts";
import { healthRoute } from "./routes/health.ts";
import { infoRoute } from "./routes/info.ts";
import { securityMiddleware } from "./security.ts";

export { DEFAULT_PORT } from "./config.ts";

export interface AppOptions {
  requestTimeoutMs?: number;
  infoRateLimit?: number;
  // Shared secret the Cloudflare Worker sends on proxied calls. Omit in
  // tests/local dev to disable the gate (see auth.ts).
  proxySecret?: string;
  reverseDnsImpl?: (ip: string) => Promise<string | undefined>;
  blocklistImpl?: (ip: string) => Promise<string[]>;
  enableGeoCrossCheck?: boolean;
  // Local dataset lookup. Injected by tests; defaults to the module GeoDb.
  geoLookupImpl?: (ip: string) => LocalGeo | null;
  isTorExit?: (ip: string) => boolean;
  // Optional online tiebreaker (ipapi.is). Off by default; when off, no outbound
  // call carrying the visitor IP is ever made.
  enableOnlineTiebreaker?: boolean;
  fetchImpl?: FetchLike;
  ipApiBaseUrl?: string;
}

export function createApp(options: AppOptions = {}) {
  const {
    requestTimeoutMs = REQUEST_TIMEOUT_MS,
    infoRateLimit = RATE_LIMIT.info,
    proxySecret,
    enableOnlineTiebreaker = ENABLE_ONLINE_TIEBREAKER,
    fetchImpl = fetch,
    ipApiBaseUrl = UPSTREAM.ipApiBaseUrl,
    isTorExit = defaultIsTorExit,
  } = options;

  const app = new Hono();
  app.use("*", securityMiddleware);

  const clientIpFor = (c: Context): string => {
    let socketAddress: string | undefined;
    try {
      socketAddress = getConnInfo(c).remote.address;
    } catch {
      socketAddress = undefined;
    }
    return getClientIp(c.req.raw.headers, socketAddress);
  };

  const enrich = createEnricher({
    reverseDnsImpl: options.reverseDnsImpl,
    blocklistImpl: options.blocklistImpl,
    geoCrossCheck: options.enableGeoCrossCheck,
    geoLookup: options.geoLookupImpl,
  });
  const lookup = createIpService({
    geoLookup: options.geoLookupImpl,
    isTorExit,
    enableOnlineTiebreaker,
    fetchImpl,
    ipApiBaseUrl,
    timeoutMs: requestTimeoutMs,
    enrich,
  });

  app.get("/health", healthRoute());

  app.get(
    "/api/info",
    requireProxySecret(proxySecret),
    rateLimit({
      windowMs: RATE_LIMIT.windowMs,
      limit: RATE_LIMIT.infoGlobal,
      keyGenerator: () => "global",
      standardHeaders: false,
    }),
    rateLimit({ windowMs: RATE_LIMIT.windowMs, limit: infoRateLimit, keyGenerator: clientIpFor }),
    infoRoute({ lookup, clientIpFor }),
  );

  app.notFound((c) => c.text("Not found", 404));

  return app;
}
