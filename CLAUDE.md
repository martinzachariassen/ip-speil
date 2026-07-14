# CLAUDE.md

Guidance for Claude Code working in this repository.

## Working agreement

You have full latitude in this repo: make edits, create/delete files, and run bash
commands (build, test, lint, git, docker, etc.) as needed to complete the task.
Prefer acting over asking when the next step is obvious. Still:

- Run `bun run check` before considering a change done.
- Don't commit or push unless asked.
- Don't touch `.claude/` settings via shell (managed by storecode; it's blocked).

## What this is

**ip-speil** ("speil" = Norwegian for *mirror*) — a privacy/network diagnostic web
app. It shows users what websites can infer about their connection: public IP,
geolocation, ISP/ASN, reverse DNS, VPN/proxy/Tor and reputation signals, WebRTC and
DNS leaks, IPv6/dual-stack routing, browser fingerprint (with an entropy estimate),
and HTTP headers. Live at **ip.mlz.no**, deployed on Railway.

**Runtime: Bun.** The server is TypeScript run directly by Bun
(`bun src/server/index.ts`) — no server build step. HTTP is handled by **Hono**, the
only runtime dependency; its middleware provides the security posture (CSP/secure
headers, body-size limit, rate limiting). The frontend is authored in TypeScript
under `src/client/` and **bundled by `bun build`** into `public/assets/js/main.js`
(the one build step). Everything else — TypeScript typecheck, Biome — is dev tooling.

Keep runtime dependencies minimal: dev tooling (TypeScript, Biome, `@types/bun`)
lives in `devDependencies`; the only thing in `dependencies` is Hono. Server-side
DNS work (reverse DNS, blocklists) uses the built-in `node:dns` — no new dependency.

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Build the client, then run the server with `--watch` on http://localhost:3000 |
| `bun start` | Production server (`bun src/server/index.ts`) — expects the client already built |
| `bun run build` | Bundle `src/client/main.ts` → `public/assets/js/main.js` (browser target) |
| `bun run build:watch` | Rebuild the client bundle on change |
| `bun test` | Bun's built-in test runner |
| `bun run typecheck` | `tsc --noEmit` for the server **and** the client (`src/client/tsconfig.json`) |
| `bun run lint` | `biome check` — lint + format check |
| `bun run format` | `biome format --write` |
| `bun run check` | build + typecheck + lint + tests (use before finishing) |

Bun is pinned via `mise.toml` and `package.json` engines. `mise.toml` also exposes
thin `[tasks]` wrappers over these scripts. A spare port like
`PORT=3456 bun src/server/index.ts` is fine for parallel smoke tests so the dev
`--watch` instance on 3000 stays untouched. Static assets are served with
`Cache-Control: max-age=300`, so hard-reload (Cmd+Shift+R) when smoke-testing
client changes in the browser.

## Layout

```text
src/
  server/
    index.ts       Entry — parses PORT, starts/stops Bun.serve, graceful shutdown
    app.ts         Hono app factory: resolves options, wires middleware + routes
    config.ts      Typed config: timeouts, cache TTLs, rate limits, CSP origins, upstream URLs
    security.ts    secureHeaders / CSP middleware (reads CLIENT_CONNECT_SRC from config)
    rate-limit.ts  In-memory fixed-window limiter (Hono middleware)
    routes/
      health.ts    GET /health
      info.ts      GET /api/info
      headers.ts   GET /api/headers
      umami.ts     GET /script.js, POST /api/send (analytics proxies)
    lib/
      client-ip.ts   getClientIp / isProbablyIp / isUnroutableIp
      ip-lookup.ts   ipapi.is fetch + normalise + IpInfo type + FetchLike
      ip-service.ts  cache + budget + enrichment pipeline over getIpInfo
      enrich.ts      composes reverse DNS + blocklists + geo cross-check
      geo-sources.ts secondary geo providers (ipwho.is, geojs.io) + country cross-check
      reputation.ts  reverse DNS (PTR) + DNS blocklist lookups via node:dns
      cache.ts       TtlCache + single-flight + DailyBudget + createCachedFetcher
      fetch.ts       FetchLike type + fetchJson helper
  client/          Frontend TypeScript — bundled to public/assets/js by `bun build`
    main.ts          Orchestration + interactions (bundle entry point)
    api.ts           Wrappers over this app's /api/* endpoints
    probes/          network (IPv4/IPv6/DoH/CF trace), webrtc, fingerprint, dns-leak
    sections/        Per-section renderers: exposure, hero, facts, privacy, browser,
                     ipv6, fingerprint, headers, webrtc
    lib/             dom, format, hash, heuristics (leak verdict, entropy, keyword lists)
    report.ts        Redacted, copyable diagnostics report
    theme.ts         Light/dark (defaults to prefers-color-scheme)
    types.ts         Shared client data shapes
    env.d.ts         Ambient types for non-standard browser APIs
    tsconfig.json    DOM-flavored typecheck (excludes *.test.ts)
public/
  index.html       Markup; loads /assets/js/main.js as a module
  robots.txt       Disallows /api/
  assets/
    css/styles.css
    fonts/*.woff2  Self-hosted (no Google Fonts, no visitor-IP leak)
    js/            Build output (gitignored): main.js + main.js.map
test/server/       Bun tests: app routes, cache, geo cross-check, IP handling
tsconfig.json      Strict server typecheck (noEmit; Bun runs the .ts directly)
biome.json         Lint + format config (covers src + test)
Dockerfile         oven/bun multi-stage: build client, then run index.ts non-root
railway.json       Railway deploy config (Dockerfile builder, /health healthcheck)
.github/workflows/ci.yml   Runs `bun run check` on push/PR
```

## Routes (wired in `src/server/app.ts`)

- `GET /api/info?ip=` — IP geolocation + VPN/Tor/proxy/abuse flags via ipapi.is,
  **enriched** with reverse DNS, DNS-blocklist hits, and a country cross-check against
  ipwho.is + geojs.io. Cached (TTL + single-flight + daily budget). Rate limited
  per-IP with a cross-IP backstop; rejects a syntactically invalid `ip` with 400.
- `GET /api/headers` — echoes request headers (minus hop-by-hop/sensitive ones)
- `GET /script.js` — first-party proxy of the Umami tracker script (cached), rate limited
- `POST /api/send` — first-party proxy that forwards Umami events (body-size limited)
- `GET /health` — returns `ok` (Railway healthcheck)
- `GET /`, `/index.html`, `/robots.txt` — static; `GET /assets/*` — static from `public/`

Note: `/api/info` and `/api/headers` are **same-origin only** — no wildcard CORS, so
other sites can't proxy off our ipapi.is quota.

## Conventions

- ES modules (`"type": "module"`), TypeScript throughout. Server targets Bun; the
  client targets the browser (DOM lib) and is bundled. Modules import each other with
  the real `.ts` extension — Bun resolves both.
- **Outbound third-party calls are protected in `lib/cache.ts`.** Any new server-side
  upstream should go through `createCachedFetcher` (cache → single-flight → budget) so
  repeat/concurrent lookups don't stampede the provider.
- **Security lives in middleware/config.** The CSP and headers are in `security.ts`;
  the allowed browser-fetch origins are `CLIENT_CONNECT_SRC` in `config.ts`. When the
  frontend talks to a new external origin, add it there or the browser blocks it.
- **Enrichment is injectable.** `createApp` accepts `reverseDnsImpl`, `blocklistImpl`,
  and `enableGeoCrossCheck` so tests stay network-free; the `FetchLike` seam covers the
  HTTP upstreams. Keep tests off the real network.
- **Client-only fingerprinting.** Fingerprint signals are computed in the browser and
  never sent to the server; only a coarse entropy estimate reaches the copyable report.
- Static files are served by Hono's `serveStatic` from `public/` (path-traversal safe).
  New browser code is just imported by a `sections/` or `probes/` module — it's bundled,
  so there's no per-file allowlist. New webfonts drop into `public/assets/fonts/`.
- No DB, no request logs, no cookies. Don't add persistence or trackers.

## Notes / gotchas

- **In-memory, single-replica.** The cache, daily budget, and rate-limiter live in
  process memory — correct for one Railway replica; scaling horizontally would fragment
  them. Revisit before adding replicas.
- **TLS/JA3/JA4 fingerprinting was evaluated and dropped:** the only free service
  (tls.peet.ws) sends no CORS header, so the browser can't read it, and proxying it
  server-side would fingerprint our server rather than the visitor.
- **DNS-leak (bash.ws) is best-effort** — it's wrapped in timeouts and degrades to the
  DoH-reachability note if the provider is unreachable.
