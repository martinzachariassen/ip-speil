import type { HeaderMap } from "@ip-speil/shared";

// Hop-by-hop / sensitive headers we never echo back — mirrors the old Bun route.
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

// NOTE: at the edge this reflects what Cloudflare forwards to the Worker, i.e.
// "what a site behind Cloudflare sees" — close to, but not identical to, the raw
// browser socket. The UI notes this caveat.
export function echoHeaders(request: Request): Response {
  const visible: HeaderMap = {};
  request.headers.forEach((value, key) => {
    if (!HIDDEN_HEADERS.has(key)) visible[key] = value;
  });
  return Response.json(visible, { headers: { "cache-control": "no-store" } });
}
