# ip-speil

> **speil** — Norwegian for *mirror*. Reflects what the internet sees of you.

![Bun](https://img.shields.io/badge/Bun-1.3-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-4.x-E36002?logo=hono&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)

A privacy and network diagnostic tool that shows what websites can infer about your
connection — your IP and approximate location, ISP/ASN, VPN/proxy/Tor signals, IP
reputation, WebRTC and DNS leaks, IPv6 routing, browser fingerprint, and the HTTP
headers your browser sends. Every check runs on demand, and the app stores nothing.

**Live at [ip.mlz.no](https://ip.mlz.no)**

---

## What it checks

| Check | What it reveals |
|---|---|
| **Exposure summary** | An at-a-glance verdict — what's visible to sites vs. what's protected |
| **IP & location** | Public IP, city, country, coordinates (city-level), ISP, ASN, reverse DNS |
| **Geo cross-check** | The country agreed on by three independent providers, as a confidence signal |
| **VPN / proxy / Tor** | Whether the IP is flagged as a proxy, VPN, Tor relay, datacenter, or hosting network |
| **IP reputation** | Whether the address is listed in abuse blocklists (Spamhaus, Barracuda) |
| **WebRTC leak** | Whether a public IP leaks through browser peer-to-peer APIs — IP-family aware, no false alarms |
| **DNS leak** | Which resolvers actually answered your queries, and whether they exit a different country |
| **IPv6 & dual-stack** | Forced IPv4 and IPv6 exits, compared against the HTTP IP for split-routing / VPN leaks |
| **Browser fingerprint** | Canvas / audio / WebGL hashes, fonts, voices, devices, plus a rough entropy ("1 in N") estimate |
| **Privacy signals** | Do Not Track, Global Privacy Control, timezone and locale-vs-geo mismatches |
| **HTTP headers** | Everything your browser sends automatically with each request |
| **Redacted report** | A copyable diagnostics summary with exact IPs and header values omitted |

---

## How it works

The server resolves the HTTP IP with [ipapi.is](https://ipapi.is), cross-checks the
country against [ipwho.is](https://ipwho.is) and [geojs.io](https://geojs.io), and
adds reverse-DNS and DNS-blocklist lookups via `node:dns` — then hands back one
enriched payload. The browser separately probes its IPv4/IPv6 exits, runs a
[bash.ws](https://bash.ws) DNS-leak test, inspects WebRTC candidates via a public STUN
server, checks [Cloudflare's trace](https://1.1.1.1/cdn-cgi/trace), and estimates a
fingerprint. **Fingerprint data is computed entirely in the browser and never sent back.**

Outbound calls to third parties are protected by a small in-memory layer:

- **TTL cache** — identical IP lookups within ~10 minutes are served from memory.
- **Single-flight** — concurrent lookups for the same IP share one upstream request.
- **Daily budget** — a global counter keeps the app under the ipapi.is free-tier
  quota, serving stale data rather than overrunning it.
- **Rate limits** — per-IP limiters plus a cross-IP backstop on the lookup route.

---

## Tech

- **Runtime**: [Bun](https://bun.sh). The server is TypeScript run directly
  (`bun src/server/index.ts`) — **no server build step**.
- **Server framework**: [Hono](https://hono.dev) — the only runtime dependency. Its
  middleware provides the security posture: a strict Content-Security-Policy and
  secure headers, a body-size limit on the analytics proxy, and rate limiting.
- **Frontend**: framework-free TypeScript ES modules under `src/client/`, bundled by
  `bun build` to `public/assets/js/main.js`. This is the only build step.
- **Tooling**: [Biome](https://biomejs.dev) for lint + format; Bun's built-in test runner.
- **Fonts**: Schibsted Grotesk + IBM Plex Mono, self-hosted from
  `public/assets/fonts/` (no Google Fonts call, no visitor-IP leak).

---

## Privacy

- No database, no application request logs, no cookies, no ad trackers.
- Browser fingerprint is computed locally and never leaves your device — only a coarse
  entropy estimate appears in the copyable report.
- Cookieless page analytics via Umami, proxied first-party.
- Running a scan makes your browser contact a few third parties directly (icanhazip,
  Cloudflare, bash.ws); the geolocation providers are called server-side and cached.

---

## Run locally

Tool versions are managed with [mise](https://mise.jdx.dev) (`mise.toml` pins Bun):

```sh
git clone git@github.com:martinzachariassen/ip-speil.git
cd ip-speil
mise install      # installs Bun (mise only pins the toolchain)
bun install       # installs Hono + dev tooling
bun run dev       # builds the client, then serves → http://localhost:3000
```

Or with Docker:

```sh
docker build -t ipspeil .
docker run -p 3000:3000 ipspeil
```

## Commands

```sh
bun run check       # build + typecheck + lint + tests (run before finishing)

bun run dev         # build client, then serve with --watch on :3000
bun run build       # bundle the client to public/assets/js
bun run typecheck   # tsc --noEmit for server + client
bun run lint        # biome check
bun run format      # biome format --write
bun test            # Bun test runner
```

## Structure

```text
src/
  server/
    index.ts         Entry — parses PORT, starts/stops Bun.serve, graceful shutdown
    app.ts           Hono app factory: wires middleware + routes
    config.ts        Typed config: timeouts, cache TTLs, rate limits, CSP origins
    security.ts      secureHeaders / CSP middleware
    rate-limit.ts    In-memory fixed-window limiter (Hono middleware)
    routes/          health, info, headers, umami (script + event proxies)
    lib/
      client-ip.ts   Client-IP extraction + IP validation
      ip-lookup.ts   ipapi.is fetch + normalise
      ip-service.ts  Cache + budget + enrichment pipeline over the lookup
      geo-sources.ts Secondary geo providers + country cross-check
      reputation.ts  Reverse DNS + DNS blocklist lookups (node:dns)
      cache.ts       TTL cache + single-flight + daily budget
      fetch.ts       Shared fetch-with-timeout helper
  client/            Frontend TypeScript (bundled to public/assets/js by `bun build`)
    main.ts          Orchestration + interactions (bundle entry point)
    probes/          network (IPv4/IPv6/DoH/CF trace), webrtc, fingerprint, dns-leak
    sections/        Per-section renderers incl. the exposure summary
    lib/             dom, format, hash, heuristics (leak verdict, entropy, keywords)
    report.ts        Redacted diagnostics report builder
    theme.ts         Light/dark theme (honours prefers-color-scheme)
    types.ts         Shared client data shapes
public/
  index.html         Markup; loads /assets/js/main.js as a module
  robots.txt         Disallows /api/
  assets/            css, self-hosted fonts (woff2), js (build output, gitignored)
test/server/         Bun tests for routes, cache, geo cross-check, IP handling
```

---

## Deploy

Deployed on [Railway](https://railway.app) from the GitHub repo via Docker.
Configuration is in `railway.json` (Dockerfile builder, `/health` healthcheck).
Pushing to `main` triggers a deploy; `.github/workflows/ci.yml` runs `bun run check`
on every push and pull request.

```sh
railway up
```

---

## License

[MIT](./LICENSE) © Martin Zachariassen
