# ip-speil

> **speil** — Norwegian for *mirror*. Reflects what the internet sees of you.

![Node.js](https://img.shields.io/badge/Node.js-24%20LTS-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-deployed-0B0D0E?logo=railway&logoColor=white)
![Zero runtime deps](https://img.shields.io/badge/runtime%20dependencies-0-brightgreen)
![No build step](https://img.shields.io/badge/build%20step-none-brightgreen)

A privacy and network diagnostic tool that shows what websites can infer about your connection — your IP address, approximate location, ISP, VPN/proxy signals, WebRTC candidates, IPv6 routing, browser fingerprint, and HTTP headers sent with requests. All checks run on demand, and the app stores no scan results.

**Live at [ip.mlz.no](https://ip.mlz.no)**

---

## What it checks

| Check | What it reveals |
|---|---|
| **IP & location** | Your public IP, city, country, ISP, and ASN |
| **VPN / proxy detection** | Whether your IP is flagged as a proxy, VPN exit node, or datacenter |
| **WebRTC leak** | Whether your real IP leaks through browser peer-to-peer APIs, even behind a VPN |
| **IPv6 routing** | Whether IPv6 is available and whether it appears to exit through a different network than IPv4 |
| **Browser fingerprint** | Canvas hash, WebGL renderer, screen resolution, hardware details — what tracks you without cookies |
| **HTTP headers** | Everything your browser sends automatically with every request |
| **Cloudflare routing** | Nearest datacenter, protocol, and whether WARP is active |
| **Redacted report** | A copyable diagnostics summary without exact IPs or header values |
| **Recommendations** | Prioritised, actionable steps based on what the scan found |

---

## Tech

- **Server**: TypeScript on Node.js 24 LTS, native `http` module — no framework. Node runs
  the `.ts` files directly via native type-stripping, so there is **no build step and zero
  runtime dependencies**. TypeScript is a dev-only typecheck (`tsc --noEmit`).
- **Frontend**: Static HTML + CSS, and native ES modules under `public/js/` — loaded
  straight by the browser, no bundler, no build.
- **Tooling**: [Biome](https://biomejs.dev) for lint + format; the Node built-in test runner.
- **Data**: IP geolocation via [ip-api.com](https://ip-api.com), routing cross-check via [Cloudflare trace](https://1.1.1.1/cdn-cgi/trace), IPv6 via [icanhazip.com](https://ipv6.icanhazip.com), WebRTC via Google STUN
- **Fingerprinting**: Computed entirely in the browser, never sent to the server

---

## Privacy

- No database, no application-level request logs, no cookies, no ad trackers
- Cookieless page analytics via Umami
- Browser fingerprint is computed locally and never leaves your device
- Every check runs on demand and scan results are not persisted by the app

---

## Run locally

Tool versions are managed with [mise](https://mise.jdx.dev) (`mise.toml` pins Node 24):

```sh
git clone git@github.com:martinzachariassen/ipspeil-no.git
cd ipspeil-no
mise install      # installs Node 24 (mise only pins the toolchain)
npm run dev       # → http://localhost:3000
```

Or with plain npm (Node 24 already on PATH):

```sh
npm run dev
```

Or with Docker:

```sh
docker build -t ipspeil .
docker run -p 3000:3000 ipspeil
```

## Check

```sh
npm run check       # typecheck + lint + tests (run before finishing)

# or individually:
npm run typecheck   # tsc --noEmit (server types)
npm run lint        # biome check
npm run format      # biome format --write
npm test            # node --test
```

## Structure

```text
src/                 Server TypeScript (run directly by Node, no build)
  server.ts          Entry point — parses PORT, starts/stops the HTTP server
  app.ts             Server factory: routing, security headers (CSP), static file serving
  ip-api.ts          ip-api.com geolocation + client-IP extraction from headers
public/              Static frontend, served as-is (no bundler)
  index.html         Markup
  styles.css         Styles
  js/                Native ES modules (no build):
    main.js            Orchestration + interactions (entry point)
    api.js             Calls this app's /api/* endpoints
    webrtc.js          WebRTC ICE-candidate / leak inspection
    network.js         IPv6 + Cloudflare trace probes
    fingerprint.js     Canvas / WebGL / display fingerprint probes
    render.js          DOM render functions
    format.js          Pure string/format helpers
    dom.js             HTML render primitives
    report.js          Redacted diagnostics report builder
    theme.js           Light/dark theme
    env.d.ts           Ambient types for non-standard browser APIs (editor only)
    jsconfig.json      Editor-only checkJs config for the browser modules
test/                Node test runner coverage for routes and upstream handling
tsconfig.json        Strict typecheck config for the server (no emit)
biome.json           Lint + format config
```

---

## Deploy

Deployed on [Railway](https://railway.app) via Docker. Configuration is in `railway.toml`.

```sh
railway up
```
