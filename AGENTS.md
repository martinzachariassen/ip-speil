---
name: ip-speil
description: Privacy/network diagnostic web app — Bun + Hono + TypeScript. Server runs .ts directly; the client is TS bundled by `bun build`.
agent-permissions:
  auto-edit:
    - src/**/*.ts
    - public/**/*
    - test/**/*.ts
    - "*.json"
    - "*.toml"
    - "*.md"
    - Dockerfile
    - .dockerignore
    - .gitignore
    - .github/**
  auto-run:
    - bun run dev
    - bun start
    - bun test
    - bun run build
    - bun run typecheck
    - bun run lint
    - bun run format
    - bun run check
    - bun install
    - bun add --dev *
    - bun src/server.ts
    - PORT=* bun src/server.ts
    - mise run *
    - curl -sS http://127.0.0.1:*/*
    - curl -fsS http://127.0.0.1:*/*
    - curl -sS -i http://127.0.0.1:*/*
    - curl -sS -I http://127.0.0.1:*/*
    - git status
    - git diff *
    - git log *
    - git show *
    - git branch *
    - rg *
    - ls *
    - fd *
  ask-first:
    - git commit *
    - git push *
    - git reset --hard *
    - rm -rf *
    - editing .env or anything with secrets
    - editing .claude/** (managed externally)
    - adding new runtime `dependencies` (keep them minimal — Hono is the only one)
    - touching Railway / DNS / infra
---

# Agents working in ip-speil

Working agreement for AI coding agents (Claude Code, Codex, etc.) in this repo.
The authoritative project rules live in [`CLAUDE.md`](./CLAUDE.md); this file
mirrors the most important bits for tools that look for `AGENTS.md`, and
declares the operations that are pre-approved here.

## TL;DR

- **Bun runtime.** The server is TypeScript run directly by Bun
  (`bun src/server.ts`) — no server build step. HTTP is served by **Hono**, the
  only runtime dependency.
- **The client has one build step.** Frontend TypeScript in `src/client/` is
  bundled by `bun build` to `public/assets/js/main.js`. `bun run dev` and the
  Docker build both run it for you.
- **Verify with `bun run check`** before finishing — build + typecheck (server
  and client) + lint + tests.
- **Don't commit or push** unless explicitly asked.
- Import local modules with the real `.ts` extension (`./app.ts`); use
  `import type` for type-only imports.

## Common operations (pre-approved)

| Need | Command |
|---|---|
| Run the dev server (watch) | `bun run dev` (port 3000) |
| Build the client bundle | `bun run build` |
| Run tests | `bun test` |
| Full check | `bun run check` |
| Type-only check | `bun run typecheck` |
| Lint / format | `bun run lint` / `bun run format` |
| Start the prod server | `bun start` (= `bun src/server.ts`) |
| Smoke a local route | `curl -sS http://127.0.0.1:3000/health` |
| Hit the IP-lookup proxy | `curl -sS "http://127.0.0.1:3000/api/info?ip=8.8.8.8"` |

A spare port like `PORT=3456 bun src/server.ts` is fine for parallel smoke tests
so the dev `--watch` instance on 3000 stays untouched.

## Editing rules

- **CSP / security headers**: configured on Hono's `secureHeaders` in
  `src/app.ts`. A new external origin needs an entry in `connectSrc`, or the
  browser will block it. Rate limiting and the body-size limit also live there.
- **Static files**: served by Hono's `serveStatic` from `public/` (it handles
  path-traversal safety — no manual allowlist to maintain). New browser code is
  imported by `main.ts` and bundled; new webfonts go in `public/assets/fonts/`.
- **Runtime deps stay minimal**: anything added to `dependencies` in
  `package.json` ships to prod. Hono is the only one — keep it that way unless
  there's a clear reason, and put dev tooling in `devDependencies`.
- **No persistence, cookies, request logs, or trackers.** By design.
- **Fingerprinting stays client-side** and is never sent to the server.

## Hands off

- `.claude/` — managed externally; don't touch via shell.
- `.env*` and anything that looks like a credential or token.
- Railway deploy config and DNS for `ip.mlz.no` — don't touch infra.

## Where things live

```text
src/server.ts     Entry — parses PORT, starts/stops Bun.serve
src/app.ts        Hono app factory: routing, security middleware, static serving
src/ip-lookup.ts  ipapi.is geolocation (HTTPS) + client-IP extraction + IP validation
src/rate-limit.ts In-memory rate limiter (Hono middleware)
src/client/       Frontend TypeScript; main.ts is the bundle entry point
public/           index.html + assets/{css,fonts,js}; js/ is build output (gitignored)
test/             Bun test runner (app.test.ts, ip-lookup.test.ts)
tsconfig.json     Strict server typecheck (noEmit); src/client/tsconfig.json for the client
biome.json        Lint + format
Dockerfile        oven/bun multi-stage (build client, run server.ts non-root)
railway.json      Railway deploy (Dockerfile builder, /health healthcheck)
```
