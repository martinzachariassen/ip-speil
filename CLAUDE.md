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
and HTTP headers. Live at **ip.mlz.no**.

**Split deployment, one repo.** It's a **Bun-workspaces monorepo** with two deploy
targets and a shared type package:

- **`apps/web`** — the public site, deployed as a **Cloudflare Worker** with static
  assets. The Worker is the same-origin front door: it serves the static page +
  bundled client, and owns the dynamic routes (`/api/headers`, `/script.js`,
  `/api/send`) at the edge. It **proxies `/api/info` to the Railway API**, attaching a
  shared bearer secret so the browser never sees it. Serves `ip.mlz.no`.
- **`apps/api`** — the enrichment backend, a **Hono** server on **Railway** (run
  directly by Bun, no build step). Exposes only `/health` and `/api/info`; the latter
  is gated by the proxy secret so only our Worker can reach it. Serves `api.ip.mlz.no`.
- **`packages/shared`** — `@ip-speil/shared`, the canonical wire types (`IpInfo`,
  `GeoSource`, `GeoCrossCheck`, `HeaderMap`) imported by both apps so the contract
  can't drift. Type-only, erased at runtime.

**Runtime: Bun.** The API is TypeScript run directly by Bun (`bun src/index.ts`) —
no server build step. **Hono** is its only runtime dependency; its middleware
provides the security-header posture and rate limiting. The client is authored in
TypeScript under `apps/web/src/client/` and **bundled by `bun build`** into
`apps/web/public/assets/js/main.js` (the one build step). The Worker
(`apps/web/src/worker/`) runs on Cloudflare's runtime. Everything else — TypeScript
typecheck, Biome — is dev tooling.

Keep runtime dependencies minimal: the API's only `dependency` is Hono (plus the
workspace `@ip-speil/shared`); the web app's only non-dev `dependency` is
`@ip-speil/shared`. Server-side DNS work (reverse DNS, blocklists) uses the built-in
`node:dns` — no new dependency.

## Commands

Run these from the **repo root** (Bun fans them out to the right workspace):

| Command | What it does |
|---|---|
| `bun run dev:api` | Run the Railway API with `--watch` (`@ip-speil/api`, http://localhost:3000) |
| `bun run dev:web` | Run the web app via `wrangler dev` (Worker + static + client) |
| `bun run build` | Bundle the client → `apps/web/public/assets/js/main.js` (browser target) |
| `bun test` | Bun's built-in test runner (currently API tests under `apps/api/test`) |
| `bun run typecheck` | `tsc --noEmit` across **every** workspace (`--filter '*'`) |
| `bun run lint` | `biome check .` — lint + format check |
| `bun run format` | `biome format --write .` |
| `bun run check` | build + typecheck + lint + tests (use before finishing) |

Per-workspace scripts also exist (e.g. `bun run --filter @ip-speil/web deploy` →
`bun run build && wrangler deploy`; `apps/api` has `start`/`dev`/`typecheck`). Bun is
pinned via `mise.toml` and root `package.json` engines. `mise.toml` also exposes thin
`[tasks]` wrappers over the root scripts. A spare port like `PORT=3456 bun
apps/api/src/index.ts` is fine for parallel smoke tests so the dev `--watch` instance
on 3000 stays untouched.

## Layout

```text
apps/
  api/                 Railway backend (Hono on Bun; no build step)
    src/
      index.ts         Entry — parses PORT, reads PROXY_SECRET, starts/stops Bun.serve
      app.ts           Hono app factory: resolves options, wires middleware + routes
      auth.ts          requireProxySecret middleware (constant-time Bearer check)
      config.ts        Typed config: timeouts, cache TTLs, rate limits, upstream URL
      security.ts      secureHeaders middleware (API headers; no page CSP — that's web)
      rate-limit.ts    In-memory fixed-window limiter (Hono middleware)
      routes/
        health.ts      GET /health
        info.ts        GET /api/info
      lib/
        client-ip.ts   getClientIp / isProbablyIp / isUnroutableIp
        ip-lookup.ts   ipapi.is fetch + normalise; re-exports IpInfo from @ip-speil/shared
        ip-service.ts  cache + budget + enrichment pipeline over getIpInfo
        enrich.ts      composes reverse DNS + blocklists + geo cross-check
        geo-sources.ts secondary geo providers (ipwho.is, geojs.io) + country cross-check
        reputation.ts  reverse DNS (PTR) + DNS blocklist lookups via node:dns
        cache.ts       TtlCache + single-flight + DailyBudget + createCachedFetcher
        fetch.ts       FetchLike type + fetchJson helper
    test/              Bun tests: app routes (+ proxy-secret), cache, geo, IP handling
    tsconfig.json      Strict API typecheck (noUncheckedIndexedAccess; types ["bun"])
    Dockerfile         oven/bun single-stage; built from REPO ROOT context, runs non-root
  web/                 Cloudflare Worker + static site + client bundle
    src/
      worker/
        index.ts       Front door: routes dynamic paths, falls through to ASSETS.fetch
        proxy.ts       proxyInfo — forwards /api/info to API_ORIGIN w/ Bearer PROXY_SECRET
        headers.ts     echoHeaders — /api/headers (minus hop-by-hop/sensitive)
        umami.ts       umamiScript (/script.js) + umamiSend (POST /api/send) proxies
        tsconfig.json  Worker typecheck (types ["@cloudflare/workers-types"])
      client/          Frontend TypeScript — bundled to public/assets/js by `bun build`
        main.ts          Orchestration + interactions (bundle entry point)
        api.ts           Wrappers over the site's /api/* endpoints
        probes/          network (IPv4/IPv6/DoH/CF trace), webrtc, fingerprint, dns-leak
        sections/        Per-section renderers: exposure, hero, facts, privacy, browser,
                         ipv6, fingerprint, headers, webrtc
        lib/             dom, format, hash, heuristics (leak verdict, entropy, keywords)
        report.ts        Redacted, copyable diagnostics report
        theme.ts         Light/dark (defaults to prefers-color-scheme)
        types.ts         Client data shapes; re-exports wire types from @ip-speil/shared
        env.d.ts         Ambient types for non-standard browser APIs
        tsconfig.json    DOM-flavored typecheck (excludes *.test.ts)
    public/            Static root served by the Worker's ASSETS binding
      index.html       Markup; loads /assets/js/main.js as a module
      robots.txt       Disallows /api/
      _headers         Cloudflare security headers + page CSP + font caching
      assets/
        css/styles.css
        fonts/*.woff2  Self-hosted (no Google Fonts, no visitor-IP leak)
        js/            Build output (gitignored): main.js + main.js.map
    wrangler.jsonc     Worker config: main, assets (run_worker_first), vars (API_ORIGIN…)
packages/
  shared/
    src/index.ts       Canonical wire types: IpInfo, GeoSource, GeoCrossCheck, HeaderMap
    package.json       @ip-speil/shared; exports "." → ./src/index.ts
tsconfig.base.json     Shared compiler options; each workspace tsconfig extends it
biome.json             Lint + format config (covers apps/** + packages/**)
railway.json           Railway deploy config (Dockerfile builder → apps/api/Dockerfile)
.github/workflows/ci.yml   Runs `bun run check` on push/PR
```

## Routes

### API (`apps/api`, wired in `src/app.ts`) — Railway, `api.ip.mlz.no`

- `GET /api/info?ip=` — IP geolocation + VPN/Tor/proxy/abuse flags via ipapi.is,
  **enriched** with reverse DNS, DNS-blocklist hits, and a country cross-check against
  ipwho.is + geojs.io. Cached (TTL + single-flight + daily budget). Rate limited
  per-IP with a cross-IP backstop; rejects a syntactically invalid `ip` with 400.
  **Gated by `requireProxySecret`** — requires `Authorization: Bearer <PROXY_SECRET>`
  (returns 401 otherwise), so only our Worker can spend our ipapi.is quota. The
  rate-limit/budget key is the real client IP, read from the `X-Forwarded-For` the
  Worker sets from `CF-Connecting-IP`.
- `GET /health` — returns `ok` (Railway healthcheck). Not gated.

### Web (`apps/web/src/worker/index.ts`) — Cloudflare, `ip.mlz.no`

The Worker runs first only for the paths in `run_worker_first`; everything else is a
static asset (`env.ASSETS.fetch`).

- `GET /api/info?ip=` → **proxied** to `${API_ORIGIN}/api/info`, with the bearer
  secret attached at the edge and the client IP forwarded via `X-Forwarded-For`.
- `GET /api/headers` → echoes request headers (minus hop-by-hop/sensitive ones).
  Note: these are **Cloudflare-flavored** headers (what a site behind Cloudflare
  sees), not the raw browser socket.
- `GET /script.js` → first-party proxy of the Umami tracker script (edge-cached).
- `POST /api/send` → first-party proxy that forwards Umami events (else 405).
- `GET /`, `/index.html`, `/robots.txt`, `/assets/*`, … → static from `public/`.

## Conventions

- ES modules (`"type": "module"`), TypeScript throughout. The API targets Bun; the
  Worker targets the Cloudflare runtime; the client targets the browser (DOM lib) and
  is bundled. Modules import each other with the real `.ts` extension. Every workspace
  tsconfig extends `tsconfig.base.json`; only `apps/api` adds
  `noUncheckedIndexedAccess`.
- **Shared types are the contract.** Wire shapes live in `@ip-speil/shared` and are
  imported (type-only) by both apps. Change a shape there, not in a local copy, so API
  and client stay in lockstep. Being type-only, it's erased at runtime — the API
  Docker image doesn't need it installed to *run*, only to typecheck.
- **The proxy secret is the lockdown.** The Worker attaches `Authorization: Bearer
  <PROXY_SECRET>` server-side (`apps/web/src/worker/proxy.ts`); the API verifies it
  (`apps/api/src/auth.ts`, constant-time). The secret never reaches the browser. In
  production the API **fails closed** — `index.ts` exits if `PROXY_SECRET` is unset.
  With no secret configured (dev/test) the middleware is a no-op, so the suite stays
  offline and env-free. Set it on both sides: `wrangler secret put PROXY_SECRET` for
  the Worker, and the `PROXY_SECRET` env var on Railway.
- **Outbound third-party calls are protected in `apps/api/src/lib/cache.ts`.** Any new
  server-side upstream should go through `createCachedFetcher` (cache → single-flight
  → budget) so repeat/concurrent lookups don't stampede the provider.
- **Security is split by tier.** The API's response headers are in
  `apps/api/src/security.ts` (no page CSP — the API serves JSON). The **page CSP and
  browser security headers live in `apps/web/public/_headers`** (a Cloudflare feature).
  When the frontend talks to a new external origin, add it to `connect-src` there or
  the browser blocks it.
- **Enrichment is injectable.** `createApp` accepts `reverseDnsImpl`, `blocklistImpl`,
  and `enableGeoCrossCheck` so tests stay network-free; the `FetchLike` seam covers the
  HTTP upstreams. Keep tests off the real network.
- **Client-only fingerprinting.** Fingerprint signals are computed in the browser and
  never sent to the server; only a coarse entropy estimate reaches the copyable report.
- New browser code is just imported by a `sections/` or `probes/` module — it's
  bundled, so there's no per-file allowlist. New webfonts drop into
  `apps/web/public/assets/fonts/`.
- No DB, no request logs, no cookies. Don't add persistence or trackers.

## Notes / gotchas

- **In-memory, single-replica (API).** The cache, daily budget, and rate-limiter live
  in the API process memory — correct for one Railway replica; scaling horizontally
  would fragment them. Revisit before adding replicas.
- **Docker build context is the repo root.** `railway.json` points at
  `apps/api/Dockerfile`, but the build must run from the repo root so it can copy the
  root manifests + workspace `package.json`s + `packages/shared`. `.dockerignore`
  excludes `apps/web` and tests from the API image.
- **Header-echo is Cloudflare-flavored.** `/api/headers` runs in the Worker, so it
  reflects the request as Cloudflare presents it, not the raw browser TCP socket.
- **TLS/JA3/JA4 fingerprinting was evaluated and dropped:** the only free service
  (tls.peet.ws) sends no CORS header, so the browser can't read it, and proxying it
  server-side would fingerprint our server rather than the visitor.
- **DNS-leak (bash.ws) is best-effort** — it's wrapped in timeouts and degrades to the
  DoH-reachability note if the provider is unreachable.
