// Command-line-friendly responses. `curl ip.mlz.no` should print just the IP,
// while a browser hitting the same URL still gets the full HTML page.
//
// These live in the Worker (not the Railway API) because the Worker is the
// same-origin front door and already knows the visitor's real IP from
// Cloudflare's `CF-Connecting-IP`. No upstream call is needed for the plain IP,
// so there is no ipapi.is quota to protect here; the enriched `/json` route
// proxies to the API, which keeps its own per-IP rate limiting.

// User-Agents that indicate a CLI/HTTP-library caller rather than a browser.
const CLI_UA =
  /(?:curl|wget|httpie|libcurl|python-requests|go-http-client|node-fetch|okhttp|powershell|ansible|lwp::|java\/|\bfetch\b)/i;

// True when the caller looks like a terminal/tool that wants plain text rather
// than the HTML page. Browsers always send `Accept: text/html`, so they never
// match; curl sends `Accept: */*` + a curl UA, and scripts can force it with
// `Accept: text/plain`.
export function wantsPlainText(request: Request): boolean {
  const accept = request.headers.get("accept") ?? "";
  if (/\btext\/html\b/i.test(accept)) return false;
  if (/\btext\/plain\b/i.test(accept)) return true;
  return CLI_UA.test(request.headers.get("user-agent") ?? "");
}

function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? "";
}

// Bare IP + newline — the classic `curl ifconfig.me` behaviour.
export function plainIp(request: Request): Response {
  return new Response(`${clientIp(request)}\n`, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
