# ip-speil

> **speil** — Norwegian for *mirror*. Reflects what the internet sees of you.

![Bun](https://img.shields.io/badge/Bun-1.3-000000?logo=bun&logoColor=white)
![Hono](https://img.shields.io/badge/Hono-4.x-E36002?logo=hono&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-deployed-0B0D0E?logo=railway&logoColor=white)

A privacy and network diagnostic tool that shows what websites can infer about your connection — your IP address, approximate location, ISP, VPN/proxy signals, WebRTC candidates, IPv6 routing, browser fingerprint, and HTTP headers sent with requests. All checks run on demand, and the app stores no scan results.

**Live at [ip.mlz.no](https://ip.mlz.no)**

---

## What it checks

| Check | What it reveals |
|---|---|
| **IP & location** | Your public IP, city, country, ISP, and ASN |
| **VPN / proxy / Tor detection** | Whether your IP is flagged as a proxy, VPN exit, Tor relay, datacenter, or known abuser |
| **WebRTC leak** | Whether your real IP leaks through browser peer-to-peer APIs, even behind a VPN |
| **IPv6 routing** | Whether IPv6 is available and whether it appears to exit through a different network than IPv4 |
| **Browser fingerprint** | Canvas + audio + WebGL hashes, screen resolution, hardware details — what tracks you without cookies |
| **HTTP headers** | Everything your browser sends automatically with every request |
| **Cloudflare routing** | Nearest datacenter, protocol, and whether WARP is active |
| **DNS-over-HTTPS reach** | Whether DoH is reachable from this network (blocked by some VPNs / DPI) |
| **Redacted report** | A copyable diagnostics summary without exact IPs or header values |

---

## Tech

- **Runtime**: [Bun](https://bun.sh). The server is TypeScript run directly by Bun
  (`bun src/server.ts`) — **no server build step**.
- **Server framework**: [Hono](https://hono.dev) — the only runtime dependency. Its
  middleware provides the hardening: a strict Content-Security-Policy and secure
  headers, a body-size limit on the analytics proxy, and an in-memory rate limiter
  on the IP-lookup endpoint (which also protects the upstream free-tier quota).
- **Frontend**: TypeScript ES modules under `src/client/`, bundled by `bun build`
  to `public/assets/js/main.js`. Fingerprinting is computed entirely in the browser
  and never sent to the server.
- **Tooling**: [Biome](https://biomejs.dev) for lint + format; Bun's built-in test runner.
- **Data**: IP geolocation + VPN/Tor/proxy/abuse signals via [ipapi.is](https://ipapi.is) over HTTPS, routing cross-check via [Cloudflare trace](https://1.1.1.1/cdn-cgi/trace), IPv6 via [icanhazip.com](https://ipv6.icanhazip.com), DNS reach via [Cloudflare DoH](https://cloudflare-dns.com), WebRTC via [Cloudflare STUN](https://stun.cloudflare.com)
- **Fonts**: Schibsted Grotesk + IBM Plex Mono — self-hosted from `public/assets/fonts/` (no Google Fonts call, no IP leak)

---

## Privacy

- No database, no application-level request logs, no cookies, no ad trackers
- Cookieless page analytics via Umami (proxied first-party)
- Browser fingerprint is computed locally and never leaves your device
- Every check runs on demand and scan results are not persisted by the app

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

## Check

```sh
bun run check       # build + typecheck + lint + tests (run before finishing)

# or individually:
bun run build       # bundle the client to public/assets/js
bun run typecheck   # tsc --noEmit for server + client
bun run lint        # biome check
bun run format      # biome format --write
bun test            # Bun test runner
```

## Structure

```text
src/
  server.ts          Entry — parses PORT, starts/stops Bun.serve
  app.ts             Hono app factory: routing, security middleware, static serving
  ip-lookup.ts       ipapi.is geolocation + client-IP extraction + IP validation
  rate-limit.ts      In-memory rate limiter (Hono middleware)
  client/            Frontend TypeScript (bundled to public/assets/js by `bun build`)
    main.ts            Orchestration + interactions (entry point)
    api.ts             Calls this app's /api/* endpoints
    webrtc.ts          WebRTC ICE-candidate / leak inspection
    network.ts         IPv6 + Cloudflare trace probes
    fingerprint.ts     Canvas / WebGL / display fingerprint probes
    render.ts          DOM render functions
    report.ts          Redacted diagnostics report builder
    format.ts          Pure string/format helpers
    dom.ts             HTML render primitives + DOM helpers
    theme.ts           Light/dark theme
    types.ts           Shared client data shapes
    env.d.ts           Ambient types for non-standard browser APIs
public/
  index.html         Markup
  assets/
    css/styles.css     Styles
    fonts/             Self-hosted webfonts (woff2)
    js/                Build output (gitignored): main.js
test/                Bun test runner coverage for routes and upstream handling
```

---

## Deploy

Deployed on [Railway](https://railway.app) from the GitHub repo via Docker.
Configuration is in `railway.json` (Dockerfile builder, `/health` healthcheck).
Pushing to `main` triggers a Railway deploy; `.github/workflows/ci.yml` runs
`bun run check` on every push and pull request.

```sh
railway up
```
