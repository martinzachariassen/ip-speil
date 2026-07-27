export const DEFAULT_PORT = 3000;

export const REQUEST_TIMEOUT_MS = 8000;

export const CACHE_CONTROL = {
  noStore: "no-store",
} as const;

export const UPSTREAM = {
  ipApiBaseUrl: "https://api.ipapi.is",
} as const;

export const RATE_LIMIT = {
  windowMs: 60 * 1000,
  info: 30,
  // Cross-IP backstop so a botnet of unique IPs still can't stampede upstream.
  infoGlobal: 300,
} as const;

export const IP_CACHE_TTL_MS = 10 * 60 * 1000;
export const IP_CACHE_MAX_ENTRIES = 5000;

// Guard below ipapi.is' 1k/day free tier; the per-IP limiter can't enforce a
// global daily cap, so this counter is what actually protects the quota.
export const IPAPI_DAILY_BUDGET = 900;
