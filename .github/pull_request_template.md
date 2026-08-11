## Summary

<!-- What does this PR change, in one or two lines? -->

## Motivation

<!-- Why is this change needed? What problem does it solve or what does it enable? -->

## Changes

<!-- The notable changes, as a short list. -->

-

## Type of change

<!-- Match the Conventional Commit type of the PR title. -->

- [ ] feat — new capability
- [ ] fix — bug fix
- [ ] docs — documentation only
- [ ] refactor — no behavior change
- [ ] chore / build / ci — tooling, dependencies, pipelines
- [ ] style / perf / test

## How tested

<!-- The exact commands you ran. Delete lines that don't apply. -->

- [ ] `bun run check` (build + typecheck + lint + tests) is green
- [ ] `bun test` for the touched area
- [ ] Ran the app locally (`bun run dev` with `apps/web/.dev.vars`) and exercised the affected area
- [ ] Verified a full scan in the browser at http://localhost:5173

## Risk & rollout

<!-- This repo has a split deployment: apps/web (Cloudflare Worker) and apps/api
     (Railway) deploy independently. Tick the target(s) this PR touches and delete
     lines that don't apply. -->

- [ ] Touches **web** (`apps/web`) — React SPA / Cloudflare Worker; redeploys via `deploy-web.yml`
- [ ] Touches **API** (`apps/api`) — Hono on Railway; redeploys via `deploy-api.yml`
- [ ] Changes a **shared wire type** (`packages/shared`) — affects BOTH apps; API and client stay in lockstep
- [ ] Changes the **`/api/info` proxy or auth path** (`PROXY_SECRET`, forwarded headers) — Worker↔API contract still holds
- [ ] Talks to a **new external origin** — added to `connect-src` in `apps/web/public/_headers`; server-side calls routed through `createCachedFetcher`
- [ ] Touches **CSP / security headers** (`_headers`, `apps/api/src/security.ts`) — no inline script/style introduced
- [ ] Breaking change (`!` in the title) — describe the migration/rollout below

## Checklist

- [ ] PR title is a Conventional Commit (`type(scope): subject`, imperative, no trailing period)
- [ ] Changes are minimal and scoped to the request
- [ ] No secrets, tokens, or keys committed (`PROXY_SECRET` and provider tokens stay in env)
- [ ] No inline `<script>`/`<style>` or `style=""` added (keeps `script-src 'self'` / `style-src 'self'`)
- [ ] Docs updated where behavior or commands changed (`README.md`, `CLAUDE.md`, `ARCHITECTURE.md`)
- [ ] CI is green
