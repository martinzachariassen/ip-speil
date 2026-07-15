<div align="center">

# ip-speil

**A privacy & network diagnostic mirror** — it shows you exactly what a website can
infer about your connection the moment you load it. *Speil* is Norwegian for **mirror**.

[![CI](https://img.shields.io/github/actions/workflow/status/martinzachariassen/ip-speil/ci.yml?branch=main&label=CI&style=flat-square)](https://github.com/martinzachariassen/ip-speil/actions/workflows/ci.yml)
[![CodeQL](https://img.shields.io/github/actions/workflow/status/martinzachariassen/ip-speil/codeql.yml?branch=main&label=CodeQL&style=flat-square)](https://github.com/martinzachariassen/ip-speil/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.securityscorecards.dev/projects/github.com/martinzachariassen/ip-speil/badge?style=flat-square)](https://scorecard.dev/viewer/?uri=github.com/martinzachariassen/ip-speil)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-1.3-14151a?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![Hono](https://img.shields.io/badge/Hono-4-e36002?style=flat-square&logo=hono&logoColor=white)](https://hono.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Deployed on Railway](https://img.shields.io/badge/Railway-deploy-0B0D0E?style=flat-square&logo=railway&logoColor=white)](https://railway.app)

[**Live at ip.mlz.no**](https://ip.mlz.no) · [What it checks](#what-it-checks) · [How it works](#how-it-works) · [Quick start](#quick-start) · [Security & privacy](#security--privacy)

</div>

## About

Every website you visit learns more than an IP address — your approximate location,
your ISP, whether you're on a VPN, sometimes a fingerprint precise enough to single you
out. **ip-speil holds up the mirror.** It runs every check on demand, shows the raw
findings alongside a plain-language verdict, and **stores nothing**.

- **On-demand, zero-retention** — no database, no request logs, no cookies, no ad
  trackers. Each scan runs when you ask and leaves no trace.
- **Client-only fingerprinting** — canvas, audio, WebGL, fonts and device signals are
  computed in *your* browser and never sent back; only a coarse entropy estimate reaches
  the copyable report.
- **Honest verdicts** — a WebRTC "leak" that's just your VPN's own IP isn't flagged as a
  leak; a DNS resolver in a different country is. The heuristics aim for signal, not scare.
- **Hardened by default** — strict CSP, per-IP rate limiting, same-origin-only APIs, and
  a cache-and-budget layer in front of every third-party call ([details](#security--privacy)).
- **One runtime dependency** — the whole server is TypeScript on [Bun](https://bun.sh),
  with [Hono](https://hono.dev) as the only thing in `dependencies`.

## What it checks

| Check | What it reveals |
| --- | --- |
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

## How it works

The server resolves the HTTP IP with [ipapi.is](https://ipapi.is), cross-checks the
country against [ipwho.is](https://ipwho.is) and [geojs.io](https://geojs.io), and adds
reverse-DNS and DNS-blocklist lookups via `node:dns` — then hands back one enriched
payload. Separately, the browser probes its own IPv4/IPv6 exits, runs a
[bash.ws](https://bash.ws) DNS-leak test, inspects WebRTC candidates through a public STUN
server, reads [Cloudflare's trace](https://1.1.1.1/cdn-cgi/trace), and estimates a
fingerprint. **The fingerprint is computed entirely client-side and never leaves the device.**

Every outbound call to a third party goes through a small in-memory guard layer
([`lib/cache.ts`](src/server/lib/cache.ts)) so the free-tier providers are never
stampeded:

- **TTL cache** — identical IP lookups within ~10 minutes are served from memory.
- **Single-flight** — concurrent lookups for the same IP share one upstream request.
- **Daily budget** — a global counter keeps the app under the ipapi.is free-tier quota,
  serving stale data rather than overrunning it.
- **Rate limits** — per-IP fixed-window limiters, plus a cross-IP backstop on the lookup route.

## Quick start

> [Bun](https://bun.sh) is pinned in `mise.toml` — [mise](https://mise.jdx.dev) installs
> the right version for you.

```bash
git clone https://github.com/martinzachariassen/ip-speil.git
cd ip-speil
mise install     # installs the pinned Bun (mise only owns the toolchain)
bun install      # installs Hono + dev tooling
bun run dev      # builds the client, then serves → http://localhost:3000
```

Or run it in a container:

```bash
docker build -t ip-speil .
docker run -p 3000:3000 ip-speil
```

Day-to-day scripts (all wrapped by thin `mise.toml` tasks):

| Command | What it does |
| --- | --- |
| `bun run dev` | Build the client, then serve with `--watch` on `http://localhost:3000` |
| `bun run build` | Bundle `src/client/main.ts` → `public/assets/js/main.js` |
| `bun run typecheck` | `tsc --noEmit` for the server **and** the client |
| `bun run lint` | `biome check` — lint + format check |
| `bun run format` | `biome format --write` |
| `bun test` | Bun's built-in test runner |
| `bun run check` | build + typecheck + lint + tests — **run before finishing** |

## Tech stack

| Layer | Choice |
| --- | --- |
| Runtime | [Bun](https://bun.sh) — pinned via `mise.toml`; runs the server TypeScript directly, no build step |
| Server | [Hono](https://hono.dev) + first-party middleware, TypeScript — the only runtime dependency |
| Frontend | Framework-free TypeScript ES modules, bundled to `public/assets/js` by `bun build` |
| DNS / reputation | Node's built-in `node:dns` — reverse DNS + blocklist lookups, no extra dependency |
| Tooling | [Biome](https://biomejs.dev) for lint + format · Bun's built-in test runner |
| Fonts | Schibsted Grotesk + IBM Plex Mono, self-hosted (no Google Fonts, no visitor-IP leak) |
| Hosting | [Railway](https://railway.app) — auto-deploy from `main`, Docker builder |
| Analytics | [Umami](https://umami.is) — cookieless, first-party proxied |

## Project structure

```text
src/
├── server/              # Bun + Hono API — TypeScript run directly, no build
│   ├── index.ts         #   entry: parses PORT, starts/stops Bun.serve, graceful shutdown
│   ├── app.ts           #   Hono app factory — wires middleware + routes (injectable seams for tests)
│   ├── config.ts        #   typed config: timeouts, cache TTLs, rate limits, CSP origins, upstreams
│   ├── security.ts      #   secureHeaders / CSP middleware
│   ├── rate-limit.ts    #   in-memory fixed-window limiter (Hono middleware)
│   ├── routes/          #   health, info, headers, umami (script + event proxies)
│   └── lib/             #   client-ip, ip-lookup, ip-service, enrich, geo-sources,
│                        #   reputation (node:dns), cache (TTL + single-flight + budget), fetch
└── client/              # frontend TypeScript — bundled to public/assets/js by `bun build`
    ├── main.ts          #   orchestration + interactions (bundle entry point)
    ├── probes/          #   network (IPv4/IPv6/DoH/CF trace), webrtc, fingerprint, dns-leak
    ├── sections/        #   per-section renderers, incl. the exposure summary
    ├── lib/             #   dom, format, hash, heuristics (leak verdict, entropy, keywords)
    ├── report.ts        #   redacted diagnostics report builder
    └── theme.ts         #   light/dark theme (honours prefers-color-scheme)
public/
├── index.html           # markup; loads /assets/js/main.js as a module
├── robots.txt           # disallows /api/
└── assets/              # css, self-hosted fonts (woff2), js (build output, gitignored)
test/server/             # Bun tests: routes, cache, geo cross-check, IP handling
Dockerfile               # oven/bun multi-stage — build client, then run non-root
railway.json             # Railway config-as-code (Dockerfile builder, /health healthcheck)
```

## Security & privacy

Security lives in middleware and config, not scattered through handlers. Each threat maps
to one deliberate defence:

| Threat | Defence |
| --- | --- |
| XSS / content injection | Strict CSP — `script-src 'self'`, `default-src 'self'`, and a hand-listed `connect-src` allowlist — via `hono/secure-headers` ([`security.ts`](src/server/security.ts)) |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` |
| MIME sniffing | `X-Content-Type-Options: nosniff` |
| Downgrade / MITM | HSTS — `max-age=2y; includeSubDomains; preload` |
| Referrer & origin leaks | `Referrer-Policy: no-referrer`; COOP + CORP `same-origin` |
| Ad-tech profiling | `Permissions-Policy` disables the Topics API (`browsing-topics`) |
| Request floods (L7) | Per-IP fixed-window rate limiting on every dynamic route, plus a cross-IP backstop ([`rate-limit.ts`](src/server/rate-limit.ts)) |
| Upstream quota theft | `/api/info` and `/api/headers` are **same-origin only** — no wildcard CORS, so other sites can't proxy off our ipapi.is quota |
| Oversized bodies | 64 KiB request-body cap on the analytics proxy (`hono/body-limit`) |
| Path traversal | `serveStatic` resolves strictly within `public/` — blocked by construction |

**Privacy posture.** No database, no application request logs, no cookies, no ad trackers.
The browser fingerprint is computed locally and never leaves your device — only a coarse
entropy estimate appears in the copyable report. Page analytics are cookieless (Umami),
proxied first-party. Running a scan does make your browser contact a few third parties
directly (icanhazip, Cloudflare, bash.ws); the geolocation providers are called server-side
and cached.

> [!NOTE]
> The cache, daily budget, and rate limiter all live in **process memory** — correct for a
> single Railway replica. Scaling horizontally would fragment them, so that state would need
> to move to a shared store (e.g. Redis) before adding replicas.

## Configuration

The server reads a single environment variable; everything else is typed configuration.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Port the server listens on |

Cache TTLs, rate-limit windows, the daily upstream budget, provider URLs, and the CSP
`connect-src` allowlist are all typed constants in
[`config.ts`](src/server/config.ts) — change them there, not via env. When the frontend
starts talking to a new external origin, add it to `CLIENT_CONNECT_SRC` or the browser's
CSP will block the fetch.

## Deployment

Every push to `main` deploys automatically to [Railway](https://railway.app) via Docker.
[`railway.json`](railway.json)
([config as code](https://docs.railway.com/reference/config-as-code)) selects the Dockerfile
builder and points the healthcheck at `/health` — during a deploy, traffic only switches to
the new version once it returns `200`, so a broken build never takes the live site down.

```bash
railway up
```

## License

[MIT](LICENSE) © [Martin Zachariassen](https://mlz.no)

---

<div align="center">
<sub>Built with <a href="https://bun.sh">Bun</a> and <a href="https://hono.dev">Hono</a> · Deployed on <a href="https://railway.app">Railway</a> · <a href="https://ip.mlz.no">ip.mlz.no</a></sub>
</div>
