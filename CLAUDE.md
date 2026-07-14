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
geolocation, ISP/ASN, VPN/proxy signals, WebRTC leaks, IPv6 routing, browser
fingerprint, and HTTP headers. Live at **ip.mlz.no**, deployed on Railway.

**Runtime: Bun.** The server is TypeScript run directly by Bun (`bun src/server.ts`)
— no server build step. HTTP is handled by **Hono**, the only runtime dependency;
its middleware provides the security posture (CSP/secure headers, body-size limit,
rate limiting). The frontend is authored in TypeScript under `src/client/` and
**bundled by `bun build`** into `public/assets/js/main.js` (this is the one build
step). Everything else — TypeScript typecheck, Biome — is dev-only tooling.

Keep runtime dependencies minimal: dev tooling (TypeScript, Biome, `@types/bun`)
lives in `devDependencies`; the only thing in `dependencies` is Hono.

## Commands

| Command | What it does |
|---|---|
| `bun run dev` | Build the client, then run the server with `--watch` on http://localhost:3000 |
| `bun start` | Production server (`bun src/server.ts`) — expects the client already built |
| `bun run build` | Bundle `src/client` → `public/assets/js/main.js` (browser target) |
| `bun run build:watch` | Rebuild the client bundle on change |
| `bun test` | Bun's built-in test runner |
| `bun run typecheck` | `tsc --noEmit` for the server **and** the client (`src/client/tsconfig.json`) |
| `bun run lint` | `biome check` — lint + format check |
| `bun run format` | `biome format --write` |
| `bun run check` | build + typecheck + lint + tests (use before finishing) |

Bun is pinned via `mise.toml` and `package.json` engines. `mise.toml` also exposes
thin `[tasks]` wrappers (`mise run check`, `mise run typecheck`, …) over these
scripts. A spare port like `PORT=3456 bun src/server.ts` is fine for parallel
smoke tests so the dev `--watch` instance on 3000 stays untouched.

## Layout

```text
src/
  server.ts      Entry point — parses PORT, starts/stops Bun.serve, graceful shutdown
  app.ts         Hono app factory: routing, security middleware, static serving
  ip-lookup.ts   ipapi.is geolocation (HTTPS) + client-IP extraction + IP validation
  rate-limit.ts  In-memory fixed-window rate limiter (Hono middleware)
  client/        Frontend TypeScript — bundled to public/assets/js by `bun build`
    main.ts        Orchestration + interactions (bundle entry point)
    api, webrtc, network, fingerprint, render, report, format, dom, theme
    types.ts       Shared client data shapes
    env.d.ts       Ambient types for non-standard browser APIs
    tsconfig.json  DOM-flavored typecheck for the client
public/
  index.html     Markup; loads /assets/js/main.js as a module
  assets/
    css/styles.css
    fonts/*.woff2  Self-hosted (no Google Fonts, no visitor-IP leak)
    js/            Build output (gitignored): main.js + main.js.map
test/            Bun test runner: app.test.ts, ip-lookup.test.ts
tsconfig.json    Strict server typecheck (noEmit; Bun runs the .ts directly)
biome.json       Lint + format config
Dockerfile       oven/bun multi-stage: build client, then run server.ts non-root
railway.json     Railway deploy config (Dockerfile builder, /health healthcheck)
.github/workflows/ci.yml   Runs `bun run check` on push/PR
```

## Routes (defined in `src/app.ts`)

- `GET /api/info?ip=` — IP geolocation + VPN/Tor/proxy/abuse flags via ipapi.is over HTTPS (defaults to caller's IP). Rate limited; rejects a syntactically invalid `ip` with 400.
- `GET /api/headers` — echoes request headers (minus hop-by-hop/sensitive ones)
- `GET /script.js` — first-party proxy of the Umami tracker script (cached 1h) so adblockers don't filter it
- `POST /api/send` — first-party proxy that forwards Umami events to `api.umami.is` (body-size limited)
- `GET /health` — returns `ok` (used by the Railway healthcheck)
- `GET /`, `/index.html` — index; `GET /assets/*` — static files from `public/`

## Conventions

- ES modules (`"type": "module"`), TypeScript throughout. Server targets Bun; the
  client targets the browser (DOM lib) and is bundled.
- Server modules import each other with the real `.ts` extension (`./app.ts`), as
  do client modules — Bun resolves both.
- **Security lives in middleware.** The CSP and other headers are configured on
  Hono's `secureHeaders` in `app.ts`. When the frontend talks to a new external
  origin, add it to `connectSrc` there or the browser will block it.
- **Static files** are served by Hono's `serveStatic` from `public/` (it handles
  path-traversal safety). New browser code just gets imported by `main.ts` — it's
  bundled, so there's no per-file allowlist to maintain. New webfonts drop into
  `public/assets/fonts/`.
- Browser fingerprinting is computed client-side only; never sent to the server.
- No DB, no request logs, no cookies. Don't add persistence or trackers.
