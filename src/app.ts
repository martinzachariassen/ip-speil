import { readFile } from "node:fs/promises";
import type { IncomingHttpHeaders, Server, ServerResponse } from "node:http";
import { createServer } from "node:http";

import { getClientIp, getIpInfo } from "./ip-api.ts";

export const DEFAULT_PORT = 3000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

const NO_STORE = "no-store";
const ASSET_CACHE = "public, max-age=300";

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

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

const DEFAULT_SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://cloud.umami.is",
    "connect-src 'self' https://cloud.umami.is https://1.1.1.1 https://ipv6.icanhazip.com",
    "img-src 'self' data:",
    "style-src 'self' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Referrer-Policy": "no-referrer",
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
}

export function createAppServer(options: AppServerOptions = {}): Server {
  const {
    fetchImpl = fetch,
    ipApiBaseUrl = "http://ip-api.com",
    publicRoot = new URL("../public/", import.meta.url),
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  } = options;

  return createServer(async (req, res) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      writeJson(res, 405, { error: "method_not_allowed" }, { Allow: "GET, HEAD" });
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/api/info") {
      const requestedIp = url.searchParams.get("ip")?.trim() ?? "";
      const ip = requestedIp || getClientIp(req.headers);
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

/** Echo request headers minus hop-by-hop/sensitive ones. */
function visibleHeaders(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  const visible: IncomingHttpHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!HIDDEN_HEADERS.has(key)) visible[key] = value;
  }
  return visible;
}
