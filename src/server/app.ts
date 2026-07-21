import type { Context } from "hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getConnInfo, serveStatic } from "hono/bun";

import {
  CACHE_CONTROL,
  MAX_SEND_BODY_BYTES,
  PUBLIC_ROOT,
  RATE_LIMIT,
  REQUEST_TIMEOUT_MS,
  UPSTREAM,
} from "./config.ts";
import { getClientIp } from "./lib/client-ip.ts";
import { createEnricher } from "./lib/enrich.ts";
import type { FetchLike } from "./lib/fetch.ts";
import { createIpService } from "./lib/ip-service.ts";
import { rateLimit } from "./rate-limit.ts";
import { headersRoute } from "./routes/headers.ts";
import { healthRoute } from "./routes/health.ts";
import { infoRoute } from "./routes/info.ts";
import { umamiRoutes } from "./routes/umami.ts";
import { securityMiddleware } from "./security.ts";

export { DEFAULT_PORT } from "./config.ts";

export interface AppOptions {
  fetchImpl?: FetchLike;
  ipApiBaseUrl?: string;
  publicRoot?: string;
  requestTimeoutMs?: number;
  infoRateLimit?: number;
  sendRateLimit?: number;
  umamiScriptUrl?: string;
  umamiSendUrl?: string;
  reverseDnsImpl?: (ip: string) => Promise<string | undefined>;
  blocklistImpl?: (ip: string) => Promise<string[]>;
  enableGeoCrossCheck?: boolean;
}

export function createApp(options: AppOptions = {}) {
  const {
    fetchImpl = fetch,
    ipApiBaseUrl = UPSTREAM.ipApiBaseUrl,
    publicRoot = PUBLIC_ROOT,
    requestTimeoutMs = REQUEST_TIMEOUT_MS,
    infoRateLimit = RATE_LIMIT.info,
    sendRateLimit = RATE_LIMIT.send,
    umamiScriptUrl = UPSTREAM.umamiScriptUrl,
    umamiSendUrl = UPSTREAM.umamiSendUrl,
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
    fetchImpl,
    timeoutMs: requestTimeoutMs,
    reverseDnsImpl: options.reverseDnsImpl,
    blocklistImpl: options.blocklistImpl,
    geoCrossCheck: options.enableGeoCrossCheck,
  });
  const lookup = createIpService({ fetchImpl, ipApiBaseUrl, timeoutMs: requestTimeoutMs, enrich });
  const umami = umamiRoutes({
    fetchImpl,
    scriptUrl: umamiScriptUrl,
    sendUrl: umamiSendUrl,
    requestTimeoutMs,
    clientIpFor,
  });

  const setStaticCache = (path: string, c: { header: (k: string, v: string) => void }) => {
    if (path.endsWith(".woff2")) c.header("Cache-Control", CACHE_CONTROL.font);
    else if (path.endsWith(".html")) c.header("Cache-Control", CACHE_CONTROL.noStore);
    else c.header("Cache-Control", CACHE_CONTROL.asset);
  };

  app.get("/health", healthRoute());

  app.get(
    "/api/info",
    rateLimit({
      windowMs: RATE_LIMIT.windowMs,
      limit: RATE_LIMIT.infoGlobal,
      keyGenerator: () => "global",
      standardHeaders: false,
    }),
    rateLimit({ windowMs: RATE_LIMIT.windowMs, limit: infoRateLimit, keyGenerator: clientIpFor }),
    infoRoute({ lookup, clientIpFor }),
  );

  app.get("/api/headers", headersRoute());

  app.get(
    "/script.js",
    rateLimit({
      windowMs: RATE_LIMIT.windowMs,
      limit: RATE_LIMIT.script,
      keyGenerator: clientIpFor,
    }),
    umami.script,
  );

  app.post(
    "/api/send",
    rateLimit({ windowMs: RATE_LIMIT.windowMs, limit: sendRateLimit, keyGenerator: clientIpFor }),
    bodyLimit({
      maxSize: MAX_SEND_BODY_BYTES,
      onError: (c) => c.json({ error: "payload_too_large" }, 413),
    }),
    umami.send,
  );

  // `root` (unlike `path`) accepts an absolute directory, so serving stays
  // independent of the process cwd. `/` rewrites to the index file.
  const staticOptions = { root: publicRoot, onFound: setStaticCache };
  app.get("/", serveStatic({ ...staticOptions, rewriteRequestPath: () => "/index.html" }));
  app.get("/index.html", serveStatic(staticOptions));
  app.get("/robots.txt", serveStatic(staticOptions));
  app.get("/favicon.ico", serveStatic(staticOptions));
  app.get("/site.webmanifest", serveStatic(staticOptions));
  app.get("/sitemap.xml", serveStatic(staticOptions));
  app.get("/assets/*", serveStatic(staticOptions));

  app.notFound((c) => c.text("Not found", 404));

  return app;
}
