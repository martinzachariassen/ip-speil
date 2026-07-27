export const DEFAULT_PORT = 3000;

export const REQUEST_TIMEOUT_MS = 8000;

export const CACHE_CONTROL = {
  noStore: "no-store",
} as const;

// ipapi.is is used ONLY by the optional online tiebreaker (off by default). The
// default scan path resolves everything from local datasets and never sends the
// visitor IP to a third party.
export const UPSTREAM = {
  ipApiBaseUrl: "https://api.ipapi.is",
} as const;

export const ENABLE_ONLINE_TIEBREAKER = false;

export const RATE_LIMIT = {
  windowMs: 60 * 1000,
  info: 30,
  // Cross-IP backstop so a botnet of unique IPs still can't hammer the resolver.
  infoGlobal: 300,
} as const;

export const IP_CACHE_TTL_MS = 10 * 60 * 1000;
export const IP_CACHE_MAX_ENTRIES = 5000;

// --- Routing / RPKI enrichment (RIPEstat) ------------------------------------
// Unlike the local geo lookup, routing context comes from RIPEstat (free, no
// key). This is the one enrichment that reaches a third party with anything
// IP-derived, so we send only a truncated network block — the visitor's exact
// address never leaves the server (see lib/routing.ts).
export const ENABLE_ROUTING = true;

export const RIPESTAT = {
  baseUrl: "https://stat.ripe.net/data",
  // Host bits below these prefix lengths are zeroed before the lookup, so the
  // resource sent upstream is a whole network block shared by many visitors.
  ipv4PrefixBits: 24,
  ipv6PrefixBits: 48,
  timeoutMs: 4000,
} as const;

// Routing and ROAs change slowly and thousands of visitors share one prefix, so
// a long TTL keeps upstream load trivial and the cache hit-rate very high.
export const ROUTING_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const ROUTING_CACHE_MAX_ENTRIES = 5000;
