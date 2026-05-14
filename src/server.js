import { readFile } from "node:fs/promises";
import { createServer } from "node:http";

import { getClientIp, getIpInfo } from "./ip-api.js";

export const DEFAULT_PORT = 3000;
export const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

const PUBLIC_FILES = new Map([
  ["/", { path: "index.html", contentType: "text/html; charset=utf-8", cacheControl: "no-store" }],
  ["/index.html", { path: "index.html", contentType: "text/html; charset=utf-8", cacheControl: "no-store" }],
  ["/app.js", { path: "app.js", contentType: "text/javascript; charset=utf-8", cacheControl: "public, max-age=300" }],
  ["/styles.css", { path: "styles.css", contentType: "text/css; charset=utf-8", cacheControl: "public, max-age=300" }],
]);

const DEFAULT_SECURITY_HEADERS = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://cloud.umami.is",
    "connect-src 'self' https://cloud.umami.is https://1.1.1.1 https://ipv6.icanhazip.com",
    "img-src 'self' data:",
    "style-src 'self'",
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

function writeResponse(res, statusCode, headers, body) {
  res.writeHead(statusCode, { ...DEFAULT_SECURITY_HEADERS, ...headers });
  res.end(body);
}

function writeJson(res, statusCode, body, headers = {}) {
  writeResponse(res, statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  }, JSON.stringify(body));
}

async function servePublicFile(res, publicRoot, pathname) {
  const file = PUBLIC_FILES.get(pathname);

  if (!file) {
    writeResponse(res, 404, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    }, "Not found");
    return;
  }

  try {
    const body = await readFile(new URL(file.path, publicRoot));
    writeResponse(res, 200, {
      "Content-Type": file.contentType,
      "Cache-Control": file.cacheControl,
    }, body);
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? err.code : "";
    writeResponse(res, code === "ENOENT" ? 404 : 500, {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    }, code === "ENOENT" ? "Not found" : "Internal Server Error");
  }
}

export function createAppServer(options = {}) {
  const {
    fetchImpl = fetch,
    ipApiBaseUrl = "http://ip-api.com",
    publicRoot = new URL("../public/", import.meta.url),
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  } = options;

  return createServer(async (req, res) => {
    if (!["GET", "HEAD"].includes(req.method ?? "")) {
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
      const visible = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (!HIDDEN_HEADERS.has(k)) visible[k] = v;
      }
      writeJson(res, 200, visible, { "Access-Control-Allow-Origin": "*" });
      return;
    }

    if (url.pathname === "/health") {
      writeResponse(res, 200, {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      }, "ok");
      return;
    }

    await servePublicFile(res, publicRoot, url.pathname);
  });
}
