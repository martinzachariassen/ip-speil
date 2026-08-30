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

// Headers whose name is worth reporting but whose value is a live credential.
// That a Cookie header was sent, and how big it is, is the exposure fact; the
// bytes are a session token, and this page is built to be screenshotted and
// shared. A visitor who has never been given a cookie by us still arrives
// carrying one — Cloudflare sets __cf_bm on managed zones.
const MASKED_HEADERS = new Set(["cookie", "authorization"]);

const mask = (value: string) => `[hidden — ${value.length} chars]`;

// NOTE: at the edge this reflects what Cloudflare forwards to the Worker, i.e.
// "what a site behind Cloudflare sees" — close to, but not identical to, the raw
// browser socket. The UI notes this caveat.
export function echoHeaders(request: Request): Response {
  const visible: HeaderMap = {};
  request.headers.forEach((value, key) => {
    if (HIDDEN_HEADERS.has(key)) return;
    visible[key] = MASKED_HEADERS.has(key) ? mask(value) : value;
  });
  return Response.json(visible, { headers: { "cache-control": "no-store" } });
}
