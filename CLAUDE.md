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
  `GeoSource`, `GeoCrossCheck`, `RoutingInfo`, `RpkiInfo`, `RpkiRoa`, `HeaderMap`)
  imported by both apps so the contract can't drift. Type-only, erased at runtime.

**Runtime: Bun.** The API is TypeScript run directly by Bun (`bun src/index.ts`) —
no server build step. **Hono** is its only runtime dependency; its middleware
provides the security-header posture and rate limiting. The web front-end is a
**React 19 SPA authored in TypeScript under `apps/web/src/`** (`main.tsx` entry,
`App.tsx` root, `components/`, `hooks/`, plus the pure `lib/`/`probes/` logic) and
**built by Vite** (`@vitejs/plugin-react` + `@tailwindcss/vite` +
`@cloudflare/vite-plugin`) into `apps/web/dist/`. Styling is **Tailwind CSS v4**,
configured CSS-first: `apps/web/src/index.css` imports the design system
(**`@martinzachariassen/design` v0.7.0**, pinned to a GitHub tag and installed from
its committed `dist/`), which provides the semantic `@theme` tokens, the self-hosted
fonts, and a base layer, and keys dark mode off a `data-theme` attribute — so colour
needs no `dark:` variants. `index.css` itself adds only a thin token bridge (local
`paper`/`ink`/`line` aliases over the system tokens). The page is built almost
entirely from that system: `Container`, `Readout`, `SectionHeading`, `DataList`
(`layout="ledger"`), `FindingList`, `Table`, `Callout`, `CopyButton`, `MarginNote`,
`GlitchText`, `ThemeProvider`/`ThemeToggle`, `InfoTip`, `ToggleGroup`. **A gap in the
system is fixed in the system** — new components land in `mlz-design` behind a
changeset and a release before ip-speil uses them, never as a local one-off. The Worker
(`apps/web/src/worker/`) runs on Cloudflare's runtime; the Cloudflare Vite plugin
runs it in workerd during `vite dev` and wires the built assets on `vite build`.
Everything else — TypeScript typecheck, Biome — is dev tooling.

Keep runtime dependencies minimal: the API's only `dependency` is Hono (plus the
workspace `@ip-speil/shared`); the web app's non-dev `dependencies` are
`@ip-speil/shared`, `react`, and `react-dom` (everything else — Vite, Tailwind,
plugins, wrangler — is a devDependency). Server-side DNS work (reverse DNS,
blocklists) uses the built-in `node:dns` — no new dependency.

**CSP-safe build.** The page CSP in `apps/web/public/_headers` is `script-src
'self'` / `style-src 'self'` with no `'unsafe-inline'`. Vite is configured
(`vite.config.ts`) with `build.modulePreload.polyfill: false` so no inline
`<script>` is emitted, and `build.assetsDir: "bundle"` so hashed JS/CSS land in
`dist/client/bundle/` as external files. React's `style={{}}` prop applies via the
CSSOM (not an inline `style=""` attribute), so it isn't blocked. The theme is set on
`<html>` before render in `main.tsx` — no inline theme script. Don't introduce inline
scripts/styles or the browser will block them.

## Commands

Run these from the **repo root** (Bun fans them out to the right workspace):

| Command | What it does |
|---|---|
| `bun run dev:api` | Run the Railway API with `--watch` (`@ip-speil/api`, http://localhost:3000) |
| `bun run dev:web` | Run the web app via `vite` (React client + Worker in workerd, HMR) |
| `bun run build` | `vite build` → `apps/web/dist/` (React client + Worker bundle) |
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

## Local development

To preview the **whole app** locally you need both targets running, and the Worker
must proxy `/api/info` to your **local** API instead of production:

- `bun run dev` — starts the API (`:3000`) and the web dev server (`:5173`)
  together (Ctrl-C stops both). Or run `bun run dev:api` and `bun run dev:web` in
  two terminals.
- **`apps/web/.dev.vars`** (gitignored; copy from `.dev.vars.example`) overrides the
  `wrangler.jsonc` `vars` during `vite dev`. It sets `API_ORIGIN=http://localhost:3000`
  so the proxy hits the local API. **Without it the Worker fetches the prod API
  (`https://api.ip.mlz.no`), which is unreachable from a dev box — the proxied
  `fetch` throws and workerd returns the opaque `internal error; reference = …`
  500.** The Worker's external-fetch routes (`proxy.ts`, `umami.ts`) now catch an
  unreachable upstream and return a clean 502 / no-op instead of that 500.
- The API's proxy gate is a **no-op when `PROXY_SECRET` is unset**, so local preview
  needs no secret. To exercise the real gate, set `PROXY_SECRET` on both sides
  (a matching line in `apps/web/.dev.vars` and the API's env).
- Optional: `bun apps/api/scripts/fetch-datasets.ts` populates the local geoip
  datasets so `/api/info` returns full data instead of the limited fallback.

## Architecture

The full file-tree Layout, the Routes reference, and the "why we made this
non-obvious call" write-ups all live in [ARCHITECTURE.md](ARCHITECTURE.md) —
read that alongside this file when you need to know where something lives or
why it's shaped the way it is.

## Conventions

- ES modules (`"type": "module"`), TypeScript throughout. The API targets Bun; the
  Worker targets the Cloudflare runtime; the client is a React SPA targeting the
  browser (DOM lib) and is built by Vite. Modules import each other with the real
  `.ts`/`.tsx` extension (`allowImportingTsExtensions`). Every workspace tsconfig
  extends `tsconfig.base.json`; only `apps/api` adds `noUncheckedIndexedAccess` (the
  web app deliberately does **not** — existing probe/lib code relies on its absence).
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
- **Styling is Tailwind v4, no CSS file to edit.** Author with utility classes;
  colours use the `@theme` tokens (`bg-paper`, `text-ink`, `border-line`, …) which
  re-colour automatically when `[data-theme]` flips — don't add `dark:` variants for
  colour. The base tokens (`:root` + `[data-theme="dark"]`), fonts, and keyframes all
  live in the design system; `src/index.css` only re-exposes the ip-speil-local
  neutrals (`paper`/`ink`/`line`) through a thin `@theme inline` bridge. New app-level
  aliases go in that bridge; a genuinely new *design* token belongs in the design
  system, not here. Keep to `script-src 'self'` / `style-src 'self'`: no inline
  `<script>`/`<style>` or `style=""` attributes (React's `style={{}}` prop is fine —
  it's CSSOM, not an HTML attribute).
- **Severity colours come from the system, not from local aliases.** The bridge used
  to carry `ok`/`warn`, which pointed at the *fill* rung and invited `text-warn` — a
  fill measures ~1.8:1 on paper, well under the 4.5:1 body-text bar. Severity now
  travels through the system's components (`StatusChip`, `StatusDot`, `Callout`) and,
  where a call site needs a colour by hand, the system's own names: **`-deep` for
  text, icons and focus rings, `-subtle` for tinted surfaces, the bare fill only as a
  background.** `mlz-design`'s `colour-usage.test.ts` enforces this upstream; there's
  no equivalent gate here, so it's on you.
- **Icons are local inline SVG** (`src/lib/icons.tsx`). The design system removed its
  `<Icon>` in v0.4 ("no icon library, deliberately") and tells consumers to bring
  their own — we draw the eight Lucide paths we use rather than adding
  `lucide-react` to an app with three runtime dependencies.
- New browser code is just imported by a component/hook/probe — Vite bundles it, so
  there's no per-file allowlist. All four fonts (Space Grotesk, Space Mono,
  Architects Daughter for `font-hand`, Instrument Serif for `font-serif`) come from
  the design system's `index-self-hosted.css` — don't re-add local webfonts.
- **`sr-only` is `position: absolute`.** Inside a horizontally-scrolling strip it
  needs a positioned ancestor within the scroller, or its containing block becomes
  the page root, it escapes the clip, and the document grows a phone-width horizontal
  scrollbar. The design system's `ReadoutCell` carries `relative` for exactly that
  reason; keep it in mind for any scroller built here.
- **The page is rules, not boxes.** Ten `Card`s make every reading look equally
  important and the borders say nothing. Sections sit straight on the paper:
  `SectionHeading` marks where one starts and measures its column, `DataList
  layout="ledger"` rules the rows, `FindingList` rules the checks, and `Absent` is
  one muted line where a whole section has nothing.
- **Every check is a `Finding`; only the verdict stands alone.** The local `Note`
  (a `Callout`) is gone — a callout is a block that demands attention, right once
  and wrong the eight times in a row this page needs, and it floated free of the
  rule every other row is measured against. `primitives.tsx` exports `Finding`
  (the system's `FindingItem` plus ip-speil's severity and a glossary tip); it must
  sit inside a `FindingList`. Reassurances that report nothing — what we sent
  upstream, what we didn't keep — are a `Footnote`, not a finding with a status dot.
  The one statement still allowed to stand on its own is `<Verdict>`, and it lives
  in the hero opposite the margin note, where the question is being asked.
- **The long readouts fold, together.** WebRTC candidates, the fingerprint signals
  and the header dump are reference material — everything in them has already been
  judged in the band and the leak checks — so they sit in `Readouts.tsx` as one
  `Accordion` under one heading, each row *title · what it found · chevron*. Three
  separately-folding `Section`s read as three things left over at the bottom of the
  sheet; and the system is explicit that "a row of independent `Collapsible`s is an
  accordion with the keyboard support left out". Because the row states the verdict,
  the readout inside must not restate it — that's why `Fingerprint` has no
  distinctiveness line and `WebRTC` only shows a finding when there *is* a leak.
- **The sheet is a grid of pairs, not a column flow.** `lg:columns-2` balances the
  whole run, so one unbreakable section landing badly leaves a screen-tall hole at
  the foot of a column — which is what put the reference readouts level with the
  middle of the other column. An explicit `lg:grid-cols-2` bounds the slack to the
  height difference inside one row. **A section that can't hold a column doesn't
  get one**: "The connection" was folded into `NetworkFacts` (both reported the
  same IPv6 exit), and `Routing` moved into the readout accordion because it's
  either a full registry ledger or a single muted line depending on whether
  RIPEstat answers, and nothing in a fixed grid survives that swing.
- **Long lists run in two columns, not full width.** `Columns` sets two `KVList`s —
  or two `FindingList`s — side by side from `lg`, with `halves()` splitting the rows.
  Two lists rather than one in CSS columns: each keeps its own rule, and a column
  break can't land between a `<dt>` and its `<dd>`. A twenty-row list set full width
  is three-quarters empty paper, and a finding set full width has a 130-character
  measure.
- **The band is always the same five readings.** `bandItems` fills any the scan
  couldn't supply with an honest "unknown" rather than dropping the cell. A failed
  lookup produces no location and no anonymity finding, and three readings stretched
  across five columns of paper looked broken.
- **`color-mix(… in oklch …, transparent)` drifts the hue.** Chrome doesn't treat
  transparent's hue as powerless, so a translucent paper mixed in `oklch` comes out
  visibly pink. Use Tailwind's alpha modifier (`bg-paper/90`), which mixes in
  `oklab` — see `SiteHeader` and `MobileActions`.
- **Theme is the design system's.** `ThemeProvider` (attribute `data-theme`, key
  `ipspeil-theme`) owns light/dark/**system**, and `ThemeToggle iconOnly` is the
  control. `lib/theme.ts` only applies the stored choice pre-paint — the system's
  `themeInitScript()` is an inline `<script>` and would be refused by our CSP.
- **The brand is the mirror mark.** ip-speil's identity is a monochrome mark built
  the same way as the MLZ mark in `@martinzachariassen/design` (solid polygon glyph
  on an ink tile, accent never in the mark): two triangles mirroring across a central
  rule — a peak and its dimmed reflection. It's defined once in
  `scripts/gen-brand-assets.ts`, which regenerates every favicon/app-icon and the
  1200×630 OG/Twitter cards (`bun run --filter @ip-speil/web gen:assets`). Edit the
  geometry there and re-run — don't hand-edit the generated PNGs/ICO.
- No DB, no request logs, no cookies. Don't add persistence or trackers.

Non-obvious gotchas (Cloudflare-injected scripts the CSP blocks, why DNS-leak
checks are best-effort, why prod console noise is expected, etc.) are in
[ARCHITECTURE.md](ARCHITECTURE.md#design-decisions--gotchas).
