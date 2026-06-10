# CLAUDE.md

Guidance for Claude Code working in this repository.

## Working agreement

You have full latitude in this repo: make edits, create/delete files, and run bash
commands (build, test, lint, git, docker, etc.) as needed to complete the task.
Prefer acting over asking when the next step is obvious. Still:

- Run `npm run check` before considering a change done.
- Don't commit or push unless asked.
- Don't touch `.claude/` settings via shell (managed by storecode; it's blocked).

## What this is

**ip-speil** ("speil" = Norwegian for *mirror*) — a privacy/network diagnostic web
app. It shows users what websites can infer about their connection: public IP,
geolocation, ISP/ASN, VPN/proxy signals, WebRTC leaks, IPv6 routing, browser
fingerprint, and HTTP headers. Live at **ip.mlz.no**, deployed on Railway.

Key constraint: **zero runtime dependencies** and **no build step**. The server is
TypeScript but Node 24 runs the `.ts` files directly via native type-stripping
(`node src/server.ts`) — TypeScript is a dev-only typecheck, never a build. The frontend
is native ES modules served as-is, no bundler. Keep it that way: dev tooling (TypeScript,
Biome, `@types/node`) lives in `devDependencies`; runtime dependencies must stay at zero.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with `--watch` on http://localhost:3000 |
| `npm start` | Production server (`node src/server.ts`) |
| `npm test` | Node built-in test runner |
| `npm run typecheck` | `tsc --noEmit` — strict typecheck of the server |
| `npm run lint` | `biome check` — lint + format check |
| `npm run format` | `biome format --write` |
| `npm run check` | typecheck + lint + tests (use before finishing) |

Node 24 is pinned via `mise.toml` (toolchain only) and `package.json` engines. `mise.toml`
no longer defines task wrappers — use the `npm run` scripts directly.

## Layout

```text
src/             Server TypeScript — run directly by Node (no build)
  server.ts      Entry point — parses PORT, starts/stops the HTTP server
  app.ts         Server factory: routing, security headers (CSP), static file serving
  ip-lookup.ts   ipapi.is geolocation (HTTPS) + client-IP extraction from headers
public/          Static frontend, served as-is (no bundler)
  index.html     Markup; loads /js/main.js as a module
  styles.css     Styles
  fonts/         Self-hosted woff2 (no Google Fonts, no visitor-IP leak)
  js/            Native ES modules (no build). main.js is the entry point; others:
                 api, webrtc, network, fingerprint, render, format, dom, report, theme.
                 env.d.ts + jsconfig.json are editor-only (loose checkJs for the browser).
test/            Node test runner: app.test.js, ip-lookup.test.js
tsconfig.json    Strict server typecheck (noEmit, type-strip-compatible flags)
biome.json       Lint + format config
Dockerfile       node:24-alpine, non-root user, copies src/ + public/, runs server.ts
railway.toml     Railway deploy config (healthcheck at /health)
```

## Routes (defined in `src/app.ts`)

- `GET /api/info?ip=` — IP geolocation + VPN/Tor/proxy/abuse flags via ipapi.is over HTTPS (defaults to caller's IP)
- `GET /api/headers` — echoes request headers (minus hop-by-hop/sensitive ones)
- `GET /script.js` — first-party proxy of the Umami tracker script (cached 1h) so adblockers don't filter it
- `POST /api/send` — first-party proxy that forwards Umami events to `api.umami.is` (same reason)
- `GET /health` — returns `ok` (used by Railway healthcheck)
- `GET /`, `/index.html`, `/styles.css`, `/js/*.js` — static files from `public/`

## Conventions

- ES modules (`"type": "module"`), ES2022. Server is `.ts`; browser is `.js` with `// @ts-check`.
- TypeScript must stay **erasable** (type-strippable): no enums/namespaces/parameter
  properties; use `import type` for type-only imports; import local modules with the real
  `.ts` extension (`./app.ts`). `erasableSyntaxOnly` in `tsconfig.json` enforces this.
- `createAppServer(options)` takes injectable deps (`fetchImpl`, `ipApiBaseUrl`,
  `publicRoot`, `requestTimeoutMs`) — this is how tests run without real network.
- Browser fingerprinting is computed client-side only; never sent to the server.
- No DB, no request logs, no cookies. Don't add persistence or trackers.
- When adding a new served file, register it in the `PUBLIC_FILES` allowlist in `app.ts`
  (a new front-end module just needs its name added to the `JS_MODULES` array; a new
  webfont needs its filename in `FONT_FILES`). The allowlist — not path resolution —
  is what prevents path traversal.
- When loading new external resources in the frontend, update the CSP in
  `DEFAULT_SECURITY_HEADERS` (`app.ts`), or the browser will block them.
