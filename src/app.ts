import { readFile } from "node:fs/promises";
import type { IncomingHttpHeaders, IncomingMessage, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";

import { DEFAULT_REQUEST_TIMEOUT_MS, getClientIp, getIpInfo } from "./ip-lookup.ts";

export const DEFAULT_PORT = 3000;

const NO_STORE = "no-store";
const ASSET_CACHE = "public, max-age=300";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".woff2": "font/woff2",
};

const FONT_CACHE = "public, max-age=31536000, immutable";

const contentTypeFor = (file: string): string => {
  const ext = file.slice(file.lastIndexOf("."));
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
};

interface StaticAsset {
  file: string;
  contentType: string;
  cacheControl: string;
}

/** Front-end ES modules served from `public/js/` (entry point: main.js). */
const JS_MODULES = [
  "main",
  "format",
  "dom",
  "api",
  "webrtc",
  "network",
  "fingerprint",
  "render",
  "report",
  "theme",
];

/** Self-hosted webfonts served from `public/fonts/`. */
const FONT_FILES = [
  "schibsted-grotesk.woff2",
  "ibm-plex-mono-400.woff2",
  "ibm-plex-mono-500.woff2",
  "ibm-plex-mono-600.woff2",
];

/**
 * Explicit allowlist of servable paths → files. An allowlist (rather than resolving
 * arbitrary paths against the public root) is what prevents path-traversal access.
 */
const PUBLIC_FILES: Map<string, StaticAsset> = new Map();
const register = (route: string, file: string, cacheControl: string) =>
  PUBLIC_FILES.set(route, { file, contentType: contentTypeFor(file), cacheControl });

register("/", "index.html", NO_STORE);
register("/index.html", "index.html", NO_STORE);
register("/styles.css", "styles.css", ASSET_CACHE);
for (const name of JS_MODULES) {
  register(`/js/${name}.js`, `js/${name}.js`, ASSET_CACHE);
}
for (const file of FONT_FILES) {
  register(`/fonts/${file}`, `fonts/${file}`, FONT_CACHE);
}

const DEFAULT_SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "connect-src 'self' https://1.1.1.1 https://ipv6.icanhazip.com https://cloudflare-dns.com",
    "img-src 'self' data:",
    "style-src 'self'",
    "font-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
  "Permissions-Policy": "interest-cohort=(), browsing-topics=()",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Content-Type-Options": "nosniff",
};

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

type HeaderMap = Record<string, string>;

function writeResponse(
  res: ServerResponse,
  statusCode: number,
  headers: HeaderMap,
  body: string | Buffer,
): void {
  res.writeHead(statusCode, { ...DEFAULT_SECURITY_HEADERS, ...headers });
  res.end(body);
}

function writeText(res: ServerResponse, statusCode: number, body: string): void {
  writeResponse(
    res,
    statusCode,
    { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": NO_STORE },
    body,
  );
}

function writeJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: HeaderMap = {},
): void {
  writeResponse(
    res,
    statusCode,
    { "Content-Type": "application/json; charset=utf-8", "Cache-Control": NO_STORE, ...headers },
    JSON.stringify(body),
  );
}

async function servePublicFile(
  res: ServerResponse,
  publicRoot: URL,
  pathname: string,
): Promise<void> {
  const asset = PUBLIC_FILES.get(pathname);
  if (!asset) {
    writeText(res, 404, "Not found");
    return;
  }

  try {
    const body = await readFile(new URL(asset.file, publicRoot));
    writeResponse(
      res,
      200,
      { "Content-Type": asset.contentType, "Cache-Control": asset.cacheControl },
      body,
    );
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? err.code : "";
    if (code === "ENOENT") {
      writeText(res, 404, "Not found");
    } else {
      writeText(res, 500, "Internal Server Error");
    }
  }
}

export interface AppServerOptions {
  fetchImpl?: typeof fetch;
  ipApiBaseUrl?: string;
  publicRoot?: URL;
  requestTimeoutMs?: number;
  /** Override for the Umami tracker script URL (proxied so adblockers see a first-party request). */
  umamiScriptUrl?: string;
  /** Override for the Umami event ingestion URL (proxied so adblockers see a first-party request). */
  umamiSendUrl?: string;
}

const UMAMI_SCRIPT_CACHE_MS = 60 * 60 * 1000;

export function createAppServer(options: AppServerOptions = {}): Server {
  const {
    fetchImpl = fetch,
    ipApiBaseUrl = "https://api.ipapi.is",
    publicRoot = new URL("../public/", import.meta.url),
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
    umamiScriptUrl = "https://cloud.umami.is/script.js",
    umamiSendUrl = "https://api.umami.is/api/send",
  } = options;

  let scriptCache: { body: Buffer; fetchedAt: number; contentType: string } | null = null;

  async function proxyUmamiScript(res: ServerResponse): Promise<void> {
    try {
      if (!scriptCache || Date.now() - scriptCache.fetchedAt > UMAMI_SCRIPT_CACHE_MS) {
        const upstream = await fetchImpl(umamiScriptUrl, {
          signal: AbortSignal.timeout(requestTimeoutMs),
        });
        if (!upstream.ok) {
          writeText(res, 502, "umami script fetch failed");
          return;
        }
        scriptCache = {
          body: Buffer.from(await upstream.arrayBuffer()),
          fetchedAt: Date.now(),
          contentType: upstream.headers.get("content-type") ?? "text/javascript; charset=utf-8",
        };
      }
      writeResponse(
        res,
        200,
        {
          "Content-Type": scriptCache.contentType,
          "Cache-Control": "public, max-age=3600",
        },
        scriptCache.body,
      );
    } catch {
      writeText(res, 502, "umami script fetch failed");
    }
  }

  async function proxyUmamiSend(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const body = await readRequestBody(req);
      const headers: Record<string, string> = {
        "Content-Type": String(req.headers["content-type"] ?? "application/json"),
      };
      const ua = req.headers["user-agent"];
      if (typeof ua === "string") headers["User-Agent"] = ua;
      const clientIp = getClientIp(req.headers, req.socket.remoteAddress);
      if (clientIp) headers["X-Forwarded-For"] = clientIp;

      const upstream = await fetchImpl(umamiSendUrl, {
        method: "POST",
        headers,
        body,
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      const respBody = Buffer.from(await upstream.arrayBuffer());
      writeResponse(
        res,
        upstream.status,
        {
          "Content-Type": upstream.headers.get("content-type") ?? "application/json; charset=utf-8",
          "Cache-Control": NO_STORE,
        },
        respBody,
      );
    } catch {
      writeJson(res, 502, { error: "umami_send_failed" });
    }
  }

  return createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/api/send" && req.method === "POST") {
      await proxyUmamiSend(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      writeJson(res, 405, { error: "method_not_allowed" }, { Allow: "GET, HEAD" });
      return;
    }

    if (url.pathname === "/script.js") {
      await proxyUmamiScript(res);
      return;
    }

    if (url.pathname === "/api/info") {
      const requestedIp = url.searchParams.get("ip")?.trim() ?? "";
      const ip = requestedIp || getClientIp(req.headers, req.socket.remoteAddress);
      try {
        const data = await getIpInfo(ip, { fetchImpl, ipApiBaseUrl, timeoutMs: requestTimeoutMs });
        writeJson(res, 200, data, { "Access-Control-Allow-Origin": "*" });
      } catch (err) {
        writeJson(res, 502, {
          error: "upstream_failed",
          message: err instanceof Error ? err.message : String(err),
        });
      }
      return;
    }

    if (url.pathname === "/api/headers") {
      writeJson(res, 200, visibleHeaders(req.headers), { "Access-Control-Allow-Origin": "*" });
      return;
    }

    if (url.pathname === "/health") {
      writeText(res, 200, "ok");
      return;
    }

    await servePublicFile(res, publicRoot, url.pathname);
  });
}

async function readRequestBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Echo request headers minus hop-by-hop/sensitive ones. */
function visibleHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  const visible: IncomingHttpHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!HIDDEN_HEADERS.has(key)) visible[key] = value;
  }
  return visible;
}
