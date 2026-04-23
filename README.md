# ip-speil

> **speil** — Norwegian for *mirror*. Reflects what the internet sees of you.

![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2022-F7DF1E?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-deployed-0B0D0E?logo=railway&logoColor=white)
![Zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen)

A privacy and network diagnostic tool that shows you exactly what the internet knows about you — your IP address, location, ISP, VPN detection, WebRTC leaks, IPv6 exposure, browser fingerprint, and HTTP headers sent with every request. All checks run on demand, nothing is stored.

**Live at [ip.mlz.no](https://ip.mlz.no)**

---

## What it checks

| Check | What it reveals |
|---|---|
| **IP & location** | Your public IP, city, country, ISP, and ASN |
| **VPN / proxy detection** | Whether your IP is flagged as a proxy, VPN exit node, or datacenter |
| **WebRTC leak** | Whether your real IP leaks through browser peer-to-peer APIs, even behind a VPN |
| **IPv6 exposure** | Whether your IPv6 address bypasses your VPN tunnel |
| **Browser fingerprint** | Canvas hash, WebGL renderer, screen resolution, hardware details — what tracks you without cookies |
| **HTTP headers** | Everything your browser sends automatically with every request |
| **Cloudflare routing** | Nearest datacenter, protocol, and whether WARP is active |
| **Recommendations** | Prioritised, actionable steps based on what the scan found |

---

## Tech

- **Runtime**: Node.js 22, native `http` module — no framework, no dependencies
- **Frontend**: Vanilla HTML, CSS, and JavaScript — no build step, no bundler
- **Data**: IP geolocation via [ip-api.com](https://ip-api.com), routing cross-check via [Cloudflare trace](https://1.1.1.1/cdn-cgi/trace), IPv6 via [icanhazip.com](https://ipv6.icanhazip.com), WebRTC via Google STUN
- **Fingerprinting**: Computed entirely in the browser, never sent to the server

---

## Privacy

- No database, no logs, no cookies, no analytics
- No third-party scripts loaded
- Browser fingerprint is computed locally and never leaves your device
- Every check runs on demand — closing the tab leaves no trace

---

## Run locally

```sh
git clone git@github.com:martinzachariassen/ipspeil-no.git
cd ipspeil-no
node server.js
# → http://localhost:3000
```

Or with Docker:

```sh
docker build -t ipspeil .
docker run -p 3000:3000 ipspeil
```

---

## Deploy

Deployed on [Railway](https://railway.app) via Docker. Configuration is in `railway.toml`.

```sh
railway up
```
