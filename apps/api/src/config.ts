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
