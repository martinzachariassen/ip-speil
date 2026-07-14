import type { Context } from "hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { getConnInfo, serveStatic } from "hono/bun";
import { secureHeaders } from "hono/secure-headers";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import {
  DEFAULT_REQUEST_TIMEOUT_MS,
  type FetchLike,
  getClientIp,
  getIpInfo,
  isProbablyIp,
} from "./ip-lookup.ts";
import { rateLimit } from "./rate-limit.ts";

export const DEFAULT_PORT = 3000;

const NO_STORE = "no-store";
const ASSET_CACHE = "public, max-age=300";
const FONT_CACHE = "public, max-age=31536000, immutable";
const SCRIPT_CACHE = "public, max-age=3600";

/** Cap on the proxied Umami event body. Real events are a few hundred bytes. */
const MAX_SEND_BODY_BYTES = 64 * 1024;
/** How long the fetched Umami tracker script is cached in memory. */
const UMAMI_SCRIPT_CACHE_MS = 60 * 60 * 1000;

/** Rate-limit window shared by the upstream-hitting API routes. */
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
/**
 * Per-IP request cap within the window. `/api/info` proxies ipapi.is (free tier
 * 1k req/day) so it's the tighter of the two; a normal page load makes ~2 calls
 * and a Refresh ~2 more, leaving generous headroom for humans while cutting off
 * scripted abuse. `/api/send` only spends Umami's own quota, so it's looser.
 */
const DEFAULT_INFO_RATE_LIMIT = 30;
const DEFAULT_SEND_RATE_LIMIT = 60;

/**
 * Content-Security-Policy and friends, expressed through Hono's typed
 * secureHeaders middleware. When the frontend starts talking to a new external
 * origin, add it to `connectSrc` here or the browser will block the request.
 */
const securityMiddleware = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    connectSrc: [
      "'self'",
      "https://1.1.1.1",
      "https://ipv6.icanhazip.com",
      "https://cloudflare-dns.com",
    ],
    imgSrc: ["'self'", "data:"],
    styleSrc: ["'self'"],
    fontSrc: ["'self'"],
    baseUri: ["'none'"],
    formAction: ["'none'"],
    frameAncestors: ["'none'"],
  },
  crossOriginOpenerPolicy: "same-origin",
  crossOriginResourcePolicy: "same-origin",
  // Leave COEP off — enabling it would break the cross-origin probe fetches.
  crossOriginEmbedderPolicy: false,
  referrerPolicy: "no-referrer",
  strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
  xContentTypeOptions: "nosniff",
  xFrameOptions: "DENY",
  // Opt out of the Topics API. (interest-cohort / FLoC is dead and no longer emitted.)
  permissionsPolicy: { browsingTopics: [] },
});

/** Request headers we never echo back from `/api/headers` (hop-by-hop/sensitive). */
const HIDDEN_HEADERS = new Set([
  "connection",
  "host",
  "keep-alive",
  "proxy-authorization",
  "proxy-authenticate",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

export interface AppOptions {
  fetchImpl?: FetchLike;
  ipApiBaseUrl?: string;
  publicRoot?: string;
  requestTimeoutMs?: number;
  /** Max `/api/info` requests per client IP per minute (default 30). */
  infoRateLimit?: number;
  /** Max `/api/send` requests per client IP per minute (default 60). */
  sendRateLimit?: number;
  /** Override for the Umami tracker script URL (proxied so adblockers see a first-party request). */
  umamiScriptUrl?: string;
  /** Override for the Umami event ingestion URL (proxied so adblockers see a first-party request). */
  umamiSendUrl?: string;
}

/** Echo request headers minus hop-by-hop/sensitive ones. */
function visibleHeaders(headers: Headers): Record<string, string> {
  const visible: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!HIDDEN_HEADERS.has(key)) visible[key] = value;
  });
  return visible;
}

export function createApp(options: AppOptions = {}) {
  const {
    fetchImpl = fetch,
    ipApiBaseUrl = "https://api.ipapi.is",
    // Absolute + module-relative so serving works regardless of the process cwd.
    publicRoot = new URL("../public", import.meta.url).pathname,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    infoRateLimit = DEFAULT_INFO_RATE_LIMIT,
    sendRateLimit = DEFAULT_SEND_RATE_LIMIT,
    umamiScriptUrl = "https://cloud.umami.is/script.js",
    umamiSendUrl = "https://api.umami.is/api/send",
  } = options;

  const app = new Hono();

  app.use("*", securityMiddleware);

  /** Best-effort client IP: proxy headers first, socket address as a fallback. */
  const clientIpFor = (c: Context): string => {
    let socketAddress: string | undefined;
    try {
      socketAddress = getConnInfo(c).remote.address;
    } catch {
      socketAddress = undefined;
    }
    return getClientIp(c.req.raw.headers, socketAddress);
  };

  const setStaticCache = (path: string, c: { header: (k: string, v: string) => void }) => {
    if (path.endsWith(".woff2")) c.header("Cache-Control", FONT_CACHE);
    else if (path.endsWith(".html")) c.header("Cache-Control", NO_STORE);
    else c.header("Cache-Control", ASSET_CACHE);
  };

  app.get("/health", (c) => {
    c.header("Cache-Control", NO_STORE);
    return c.text("ok");
  });

  app.get(
    "/api/info",
    rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, limit: infoRateLimit, keyGenerator: clientIpFor }),
    async (c) => {
      const requested = c.req.query("ip")?.trim() ?? "";
      if (requested && !isProbablyIp(requested)) {
        return c.json({ error: "invalid_ip" }, 400);
      }

      const ip = requested || clientIpFor(c);
      try {
        const data = await getIpInfo(ip, {
          fetchImpl,
          ipApiBaseUrl,
          timeoutMs: requestTimeoutMs,
        });
        c.header("Cache-Control", NO_STORE);
        c.header("Access-Control-Allow-Origin", "*");
        return c.json(data);
      } catch (err) {
        return c.json(
          {
            error: "upstream_failed",
            message: err instanceof Error ? err.message : String(err),
          },
          502,
        );
      }
    },
  );

  app.get("/api/headers", (c) => {
    c.header("Cache-Control", NO_STORE);
    c.header("Access-Control-Allow-Origin", "*");
    return c.json(visibleHeaders(c.req.raw.headers));
  });

  // First-party proxy of the Umami tracker script so adblockers don't filter it.
  let scriptCache: { body: ArrayBuffer; fetchedAt: number; contentType: string } | null = null;
  app.get("/script.js", async (c) => {
    try {
      if (!scriptCache || Date.now() - scriptCache.fetchedAt > UMAMI_SCRIPT_CACHE_MS) {
        const upstream = await fetchImpl(umamiScriptUrl, {
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
        if (!upstream.ok) return c.text("umami script fetch failed", 502);
        scriptCache = {
          body: await upstream.arrayBuffer(),
          fetchedAt: Date.now(),
          contentType: upstream.headers.get("content-type") ?? "text/javascript; charset=utf-8",
        };
      }
      c.header("Content-Type", scriptCache.contentType);
      c.header("Cache-Control", SCRIPT_CACHE);
      return c.body(scriptCache.body);
    } catch {
      return c.text("umami script fetch failed", 502);
    }
  });

  // First-party proxy that forwards Umami events, propagating the client IP.
  app.post(
    "/api/send",
    rateLimit({ windowMs: RATE_LIMIT_WINDOW_MS, limit: sendRateLimit, keyGenerator: clientIpFor }),
    bodyLimit({
      maxSize: MAX_SEND_BODY_BYTES,
      onError: (c) => c.json({ error: "payload_too_large" }, 413),
    }),
    async (c) => {
      try {
        const body = await c.req.arrayBuffer();
        const headers: Record<string, string> = {
          "Content-Type": c.req.header("content-type") ?? "application/json",
        };
        const ua = c.req.header("user-agent");
        if (ua) headers["User-Agent"] = ua;
        const clientIp = clientIpFor(c);
        if (clientIp) headers["X-Forwarded-For"] = clientIp;

        const upstream = await fetchImpl(umamiSendUrl, {
          method: "POST",
          headers,
          body,
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
        c.header(
          "Content-Type",
          upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
        );
        c.header("Cache-Control", NO_STORE);
        return c.body(await upstream.arrayBuffer(), upstream.status as ContentfulStatusCode);
      } catch {
        return c.json({ error: "umami_send_failed" }, 502);
      }
    },
  );

  // `root` (unlike `path`) accepts an absolute directory, so serving stays
  // independent of the process cwd. `/` rewrites to the index file.
  const staticOptions = { root: publicRoot, onFound: setStaticCache };
  app.get("/", serveStatic({ ...staticOptions, rewriteRequestPath: () => "/index.html" }));
  app.get("/index.html", serveStatic(staticOptions));
  app.get("/assets/*", serveStatic(staticOptions));

  app.notFound((c) => c.text("Not found", 404));

  return app;
}
