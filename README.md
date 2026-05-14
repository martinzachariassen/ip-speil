# ip-speil

> **speil** — Norwegian for *mirror*. Reflects what the internet sees of you.

![Node.js](https://img.shields.io/badge/Node.js-24%20LTS-339933?logo=node.js&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-deployed-0B0D0E?logo=railway&logoColor=white)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

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

- **Runtime**: Node.js 24 LTS, native `http` module — no framework, no runtime dependencies
- **Frontend**: Static HTML, CSS, and JavaScript from `public/` — no build step, no bundler
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

```sh
git clone git@github.com:martinzachariassen/ipspeil-no.git
cd ipspeil-no
direnv allow
npm run dev
# → http://localhost:3000
```

Without direnv:

```sh
devbox run dev
```

Or with Docker:

```sh
docker build -t ipspeil .
docker run -p 3000:3000 ipspeil
```

## Check

```sh
devbox run check
```

Optional browser smoke test:

```sh
devbox run npm run smoke:browser
```

## Structure

```text
src/       Node HTTP server and ip-api integration
public/    Static frontend assets
test/      Node test runner coverage for routes and upstream handling
```

---

## Deploy

Deployed on [Railway](https://railway.app) via Docker. Configuration is in `railway.toml`.

```sh
railway up
```
