export const DEFAULT_PORT = 3000;

export const REQUEST_TIMEOUT_MS = 8000;

export const CACHE_CONTROL = {
  noStore: "no-store",
  asset: "public, max-age=300",
  font: "public, max-age=31536000, immutable",
  script: "public, max-age=3600",
} as const;

export const UPSTREAM = {
  ipApiBaseUrl: "https://api.ipapi.is",
  umamiScriptUrl: "https://cloud.umami.is/script.js",
  umamiSendUrl: "https://api.umami.is/api/send",
} as const;

export const RATE_LIMIT = {
  windowMs: 60 * 1000,
  info: 30,
  send: 60,
  script: 60,
  // Cross-IP backstop so a botnet of unique IPs still can't stampede upstream.
  infoGlobal: 300,
} as const;

export const MAX_SEND_BODY_BYTES = 64 * 1024;
export const UMAMI_SCRIPT_CACHE_MS = 60 * 60 * 1000;

export const IP_CACHE_TTL_MS = 10 * 60 * 1000;
export const IP_CACHE_MAX_ENTRIES = 5000;

// Guard below ipapi.is' 1k/day free tier; the per-IP limiter can't enforce a
// global daily cap, so this counter is what actually protects the quota.
export const IPAPI_DAILY_BUDGET = 900;

export const PUBLIC_ROOT = new URL("../../public", import.meta.url).pathname;

// Origins the browser probes fetch directly. Anything the client talks to must
// be listed here or the CSP blocks it. bash.ws needs a wildcard for the
// per-test <id> subdomains the DNS-leak probe resolves.
export const CLIENT_CONNECT_SRC = [
  "'self'",
  "https://1.1.1.1",
  "https://ipv4.icanhazip.com",
  "https://ipv6.icanhazip.com",
  "https://cloudflare-dns.com",
  "https://bash.ws",
  "https://*.bash.ws",
] as const;
