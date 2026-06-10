// @ts-check
// Wrappers around this app's own JSON endpoints.

/**
 * Look up IP geolocation via the server. Pass an `ip` to look up a specific
 * address, or omit it to look up the caller's. Resolves to `{}` on failure.
 */
export async function fetchInfo(ip) {
  const url = ip ? `/api/info?ip=${encodeURIComponent(ip)}` : "/api/info";
  return fetch(url)
    .then((r) => r.json())
    .catch(() => ({}));
}

/** Fetch the request headers the server saw. Resolves to `{}` on failure. */
export async function fetchHeaders() {
  return fetch("/api/headers")
    .then((r) => r.json())
    .catch(() => ({}));
}
