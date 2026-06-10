---
name: ip-speil
description: Privacy/network diagnostic web app — zero runtime deps, no build step, Node 24 runs TypeScript directly.
agent-permissions:
  auto-edit:
    - src/**/*.ts
    - public/**/*
    - test/**/*.js
    - "*.json"
    - "*.toml"
    - "*.md"
    - Dockerfile
    - .dockerignore
    - .gitignore
  auto-run:
    - npm run dev
    - npm start
    - npm test
    - npm run typecheck
    - npm run lint
    - npm run format
    - npm run check
    - npm ci
    - npm install --save-dev *
    - node src/server.ts
    - PORT=* node src/server.ts
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
    - adding runtime `dependencies` (must stay zero)
    - touching Railway / DNS / infra
---

# Agents working in ip-speil

Working agreement for AI coding agents (Claude Code, Codex, etc.) in this repo.
The authoritative project rules live in [`CLAUDE.md`](./CLAUDE.md); this file
mirrors the most important bits for tools that look for `AGENTS.md`, and
declares the operations that are pre-approved here.

## TL;DR

- **Zero runtime deps, no build step.** Node 24 runs `.ts` files directly via
  native type-stripping (`node src/server.ts`). TypeScript and Biome are
  dev-only.
- **Verify with `npm run check`** before finishing — typecheck + lint + tests.
- **Don't commit or push** unless explicitly asked.
- **Stay erasable**: no enums, namespaces, or parameter properties; use
  `import type` for type-only imports; local module imports use the real `.ts`
  extension (`./app.ts`). `erasableSyntaxOnly` in `tsconfig.json` enforces it.

## Common operations (pre-approved)

| Need | Command |
|---|---|
| Run the dev server (watch) | `npm run dev` (port 3000) |
| Run tests | `npm test` |
| Full check | `npm run check` |
| Type-only check | `npm run typecheck` |
| Lint / format | `npm run lint` / `npm run format` |
| Start the prod server | `npm start` (= `node src/server.ts`) |
| Smoke a local route | `curl -sS http://127.0.0.1:3000/health` |
| Hit the IP-lookup proxy | `curl -sS "http://127.0.0.1:3000/api/info?ip=8.8.8.8"` |

A spare port like `PORT=3456 node src/server.ts` is fine for parallel smoke
tests so the dev `--watch` instance on 3000 stays untouched.

## Editing rules

- **CSP**: new external resources need an entry in `DEFAULT_SECURITY_HEADERS`
  in `src/app.ts`, or the browser will block them.
- **Static allowlist**: new served files need an entry in `PUBLIC_FILES` (and
  `JS_MODULES` for new browser modules) in `src/app.ts`. The allowlist — not
  path resolution — is what prevents traversal.
- **No runtime deps**: anything added to `dependencies` in `package.json` ships
  to prod. Dev tooling goes in `devDependencies`. The contract is "zero
  runtime deps"; don't break it without asking.
- **No persistence, cookies, request logs, or trackers.** By design.
- **Fingerprinting stays client-side** and is never sent to the server.

## Hands off

- `.claude/` — managed externally; don't touch via shell.
- `.env*` and anything that looks like a credential or token.
- Railway deploy config and DNS for `ip.mlz.no` — Claude doesn't touch infra.

## Where things live

```text
src/server.ts     Entry — parses PORT, starts/stops the HTTP server
src/app.ts        Routing, CSP/security headers, static serving, PUBLIC_FILES
src/ip-lookup.ts  ipapi.is geolocation (HTTPS) + client-IP extraction
public/           Static frontend, served as-is (no bundler)
public/js/        Native ES modules; main.js is the entry point
test/             Node built-in test runner
tsconfig.json     Strict, noEmit, type-strip-compatible
biome.json        Lint + format
```
