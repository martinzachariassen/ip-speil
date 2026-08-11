---
name: ip-speil
description: Privacy/network diagnostic web app — Bun-workspaces monorepo (Hono API on Railway + React/Cloudflare Worker web app), TypeScript throughout.
agent-permissions:
  auto-edit:
    - apps/*/src/**/*.ts
    - apps/*/src/**/*.tsx
    - apps/*/test/**/*.ts
    - packages/shared/src/**/*.ts
    - apps/web/public/**/*
    - "*.json"
    - "*.toml"
    - "*.md"
    - Dockerfile
    - .dockerignore
    - .gitignore
    - .github/**
  auto-run:
    - bun run dev
    - bun run dev:api
    - bun run dev:web
    - bun test
    - bun run build
    - bun run typecheck
    - bun run lint
    - bun run format
    - bun run check
    - bun install
    - bun add --dev *
    - bun apps/api/src/index.ts
    - PORT=* bun apps/api/src/index.ts
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
    - adding new runtime `dependencies` (keep them minimal — API's only one is Hono;
      web's are @ip-speil/shared, react, react-dom)
    - touching Railway / Cloudflare / DNS / infra
---

# Agents working in ip-speil

This file exists only because some tools (Codex, Cursor, Aider, …) look for
`AGENTS.md` by convention and don't read `CLAUDE.md`.

**The rules live in [`CLAUDE.md`](./CLAUDE.md) — read that.** It's kept current;
this file is not, on purpose, so there's one place to update instead of two.
The frontmatter above declares the operations pre-approved in this repo for
tools that honor an `agent-permissions` block.
