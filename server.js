#!/usr/bin/env node
// @ts-check
import { createServer } from "node:http";

const PORT = process.env.PORT || 3000;

const IP_API_FIELDS = [
  "status", "message", "country", "countryCode", "region", "regionName",
  "city", "zip", "lat", "lon", "timezone", "offset", "isp", "org",
  "as", "asname", "reverse", "mobile", "proxy", "hosting", "query",
].join(",");

async function getIpInfo(ip) {
  const endpoint = ip
    ? `http://ip-api.com/json/${encodeURIComponent(ip)}`
    : "http://ip-api.com/json/";
  const res = await fetch(`${endpoint}?fields=${IP_API_FIELDS}`, {
    signal: AbortSignal.timeout(8000),
  });
  return res.json();
}

const HIDDEN_HEADERS = new Set(["host", "connection", "keep-alive"]);

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost`);

  if (url.pathname === "/api/info") {
    const forwarded = req.headers["x-forwarded-for"];
    const realIp = req.headers["x-real-ip"];
    const ip = (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "") ||
               (typeof realIp === "string" ? realIp : "") || "";
    try {
      const data = await getIpInfo(ip);
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify(data));
    } catch (err) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "upstream_failed", message: String(err) }));
    }
    return;
  }

  if (url.pathname === "/api/headers") {
    const visible = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!HIDDEN_HEADERS.has(k)) visible[k] = v;
    }
    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify(visible));
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(PAGE);
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`▶  http://localhost:${PORT}`);
});

/* ─────────────────────────────────────────────── HTML PAGE ── */
const PAGE = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ipspeil — your internet mirror</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

:root{
  --bg:#09090b;
  --s1:#111113;
  --s2:#18181b;
  --border:#27272a;
  --text:#f4f4f5;
  --muted:#71717a;
  --dim:#3f3f46;
  --blue:#60a5fa;
  --green:#4ade80;
  --red:#f87171;
  --yellow:#fbbf24;
  --purple:#c084fc;
  --r:14px;
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{
  background:var(--bg);
  color:var(--text);
  font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
  font-size:15px;
  line-height:1.6;
  min-height:100vh;
  padding:2rem 1rem 4rem;
}
a{color:var(--blue);text-decoration:none}

/* ── layout ── */
.wrap{max-width:960px;margin:0 auto}

header{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:1rem;
  margin-bottom:1.75rem;
}
.header-left h1{
  font-size:1rem;
  font-weight:600;
  color:var(--muted);
  letter-spacing:.08em;
  text-transform:uppercase;
}
.header-left p{
  font-size:.78rem;
  color:var(--dim);
  margin-top:.2rem;
}
.header-left p em{
  font-style:normal;
  color:var(--muted);
  font-weight:600;
}
.header-actions{display:flex;gap:.5rem;align-items:center;flex-shrink:0}
#refresh-btn{
  background:none;
  border:1px solid var(--border);
  color:var(--muted);
  border-radius:8px;
  padding:.35rem .75rem;
  font-size:.85rem;
  cursor:pointer;
  transition:color .15s,border-color .15s;
}
#refresh-btn:hover{color:var(--text);border-color:var(--dim)}
#refresh-btn.spinning{animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── trust strip ── */
.trust-strip{
  display:flex;
  flex-wrap:wrap;
  gap:.4rem;
  margin-bottom:1.25rem;
}
.trust-pill{
  display:inline-flex;
  align-items:center;
  gap:.35rem;
  background:rgba(255,255,255,.03);
  border:1px solid var(--border);
  border-radius:999px;
  padding:.2rem .65rem;
  font-size:.72rem;
  color:var(--muted);
  letter-spacing:.02em;
}
.trust-pill svg{opacity:.5;flex-shrink:0}

/* ── hero ── */
.hero{
  background:linear-gradient(135deg,#0f0f14 0%,#13131c 100%);
  border:1px solid var(--border);
  border-radius:var(--r);
  padding:2.5rem 2rem;
  text-align:center;
  margin-bottom:1.25rem;
  position:relative;
  overflow:hidden;
}
.hero::before{
  content:'';
  position:absolute;
  inset:-40%;
  background:radial-gradient(ellipse at 50% 50%,rgba(96,165,250,.06) 0%,transparent 70%);
  pointer-events:none;
}
#ip-wrapper{
  display:inline-flex;
  flex-direction:column;
  align-items:center;
  gap:.45rem;
  cursor:pointer;
  padding:.6rem 1.2rem;
  border-radius:12px;
  transition:background .15s;
}
#ip-wrapper:hover{background:rgba(255,255,255,.04)}
#ip-display{
  font-family:'SF Mono','JetBrains Mono','Fira Code',ui-monospace,monospace;
  font-size:clamp(1.8rem,5vw,3rem);
  font-weight:700;
  letter-spacing:.04em;
  user-select:all;
  transition:color .15s;
  color:var(--text);
}
#ip-wrapper:hover #ip-display{color:var(--blue)}
#copy-hint{
  font-size:.7rem;
  color:var(--dim);
  letter-spacing:.06em;
  transition:color .15s;
}
#ip-wrapper:hover #copy-hint{color:var(--blue)}
.hero-sub{margin-top:.75rem;color:var(--muted);font-size:.9rem}
.status-row{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:.5rem;
  margin-top:1.25rem;
  flex-wrap:wrap;
}

/* ── badges ── */
.badge{
  display:inline-flex;
  align-items:center;
  gap:.4rem;
  padding:.3rem .75rem;
  border-radius:999px;
  font-size:.8rem;
  font-weight:600;
  letter-spacing:.04em;
  border:1px solid transparent;
}
.badge.clean{background:rgba(74,222,128,.1);border-color:rgba(74,222,128,.25);color:var(--green)}
.badge.warn{background:rgba(251,191,36,.1);border-color:rgba(251,191,36,.25);color:var(--yellow)}
.badge.risk{background:rgba(248,113,113,.1);border-color:rgba(248,113,113,.25);color:var(--red)}
.badge.info{background:rgba(96,165,250,.08);border-color:rgba(96,165,250,.2);color:var(--blue)}
.badge.neutral{background:rgba(113,113,122,.1);border-color:rgba(113,113,122,.2);color:var(--muted)}
.dot{width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block;flex-shrink:0}

/* ── grids ── */
.grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(260px,1fr));
  gap:1rem;
  margin-bottom:1rem;
}
.grid-2{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(300px,1fr));
  gap:1rem;
  margin-bottom:1rem;
}

/* ── cards ── */
.card{
  background:var(--s2);
  border:1px solid var(--border);
  border-radius:var(--r);
  padding:1.5rem 1.6rem;
  transition:border-color .2s;
}
.card:hover{border-color:var(--dim)}
.card-title{
  font-size:.7rem;
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:.1em;
  color:var(--muted);
  margin-bottom:1.1rem;
  display:flex;
  align-items:center;
  gap:.5rem;
}
.card-title svg{opacity:.5;flex-shrink:0}
.card-title .note{
  font-weight:400;
  letter-spacing:0;
  text-transform:none;
  font-size:.72rem;
  color:var(--dim);
  margin-left:.25rem;
}

/* ── table rows ── */
.row{
  display:flex;
  align-items:baseline;
  justify-content:space-between;
  gap:.5rem;
  padding:.45rem .3rem;
  margin:0 -.3rem;
  border-bottom:1px solid rgba(255,255,255,.04);
  font-size:.88rem;
  border-radius:6px;
  transition:background .1s;
}
.row:last-child{border-bottom:none}
.row:hover{background:rgba(255,255,255,.03)}
.row-label{color:var(--muted);flex-shrink:0;margin-right:.5rem}
.row-val{font-weight:500;text-align:right;word-break:break-all}
.row-val.mono{font-family:'SF Mono','JetBrains Mono',monospace;font-size:.82rem}

/* ── indicators ── */
.indicator{
  display:flex;
  align-items:flex-start;
  gap:.6rem;
  padding:.45rem 0;
  border-bottom:1px solid rgba(255,255,255,.04);
  font-size:.88rem;
}
.indicator:last-child{border-bottom:none}
.ind-icon{
  width:20px;height:20px;border-radius:50%;margin-top:.1rem;
  display:flex;align-items:center;justify-content:center;
  font-size:.7rem;flex-shrink:0;font-weight:700;
}
.ind-icon.ok{background:rgba(74,222,128,.15);color:var(--green)}
.ind-icon.bad{background:rgba(248,113,113,.15);color:var(--red)}
.ind-icon.warn{background:rgba(251,191,36,.12);color:var(--yellow)}
.ind-icon.neutral{background:rgba(113,113,122,.15);color:var(--muted)}
.ind-label{flex:1}
.ind-label small{display:block;color:var(--muted);font-size:.78rem;margin-top:.05rem}

/* ── ip tags (WebRTC) ── */
.ip-tag-list{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.6rem}
.ip-tag{
  font-family:'SF Mono','JetBrains Mono',monospace;
  font-size:.78rem;
  background:var(--s1);
  border:1px solid var(--border);
  border-radius:6px;
  padding:.2rem .5rem;
  color:var(--text);
}
.ip-tag.leak{border-color:rgba(248,113,113,.4);background:rgba(248,113,113,.05);color:var(--red)}
.ip-tag.local{border-color:rgba(96,165,250,.2);background:rgba(96,165,250,.04);color:var(--blue)}

/* ── fingerprint ── */
.fp-hash{
  font-family:'SF Mono','JetBrains Mono',monospace;
  font-size:.82rem;
  background:var(--s1);
  border:1px solid var(--border);
  border-radius:8px;
  padding:.5rem .75rem;
  margin-bottom:1rem;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:.5rem;
  flex-wrap:wrap;
}
.fp-hash-label{font-size:.7rem;color:var(--muted);font-family:inherit}
.fp-hash-val{color:var(--purple);letter-spacing:.08em}

/* ── header rows ── */
.header-row{
  display:flex;
  align-items:baseline;
  gap:.5rem;
  padding:.3rem 0;
  border-bottom:1px solid rgba(255,255,255,.04);
  font-size:.82rem;
  flex-wrap:wrap;
}
.header-row:last-child{border-bottom:none}
.header-key{
  font-family:'SF Mono','JetBrains Mono',monospace;
  color:var(--blue);
  flex-shrink:0;
  font-size:.78rem;
}
.header-val{color:var(--muted);word-break:break-all}

/* ── tz mismatch ── */
.tz-mismatch{font-size:.78rem;color:var(--yellow);margin-top:.3rem}

/* ── ua text ── */
.ua-text{font-size:.75rem;color:var(--muted);word-break:break-all;margin-top:.3rem;line-height:1.5}

/* ── skeleton ── */
@keyframes shimmer{
  0%{background-position:-400px 0}
  100%{background-position:400px 0}
}
.skel{
  background:linear-gradient(90deg,var(--s2) 25%,#222226 50%,var(--s2) 75%);
  background-size:800px 100%;
  animation:shimmer 1.4s infinite linear;
  border-radius:6px;
  height:1em;
  display:inline-block;
  width:100%;
}
.skel-block{height:5em;border-radius:8px;margin-top:.5rem}

/* ── footer ── */
footer{
  margin-top:2.5rem;
  border-top:1px solid var(--border);
  padding-top:1.5rem;
}
.footer-grid{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(200px,1fr));
  gap:1rem;
  font-size:.78rem;
  color:var(--dim);
  line-height:1.7;
}
.footer-grid h3{
  font-size:.68rem;
  text-transform:uppercase;
  letter-spacing:.1em;
  font-weight:700;
  color:var(--muted);
  margin-bottom:.4rem;
}
</style>
</head>
<body>
<div class="wrap">

<!-- HEADER -->
<header>
  <div class="header-left">
    <h1>ipspeil</h1>
    <p><em>speil</em> — Norwegian for mirror. Reflects what the internet sees of you.</p>
  </div>
  <div class="header-actions">
    <button id="refresh-btn" onclick="load()" title="Refresh all checks">↺</button>
  </div>
</header>

<!-- TRUST STRIP -->
<div class="trust-strip">
  <span class="trust-pill">
    <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
    No cookies
  </span>
  <span class="trust-pill">
    <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
    No server logs
  </span>
  <span class="trust-pill">
    <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
    No analytics
  </span>
  <span class="trust-pill">
    <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
    No third-party scripts
  </span>
  <span class="trust-pill">
    <svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
    Fingerprint computed locally
  </span>
</div>

<!-- HERO -->
<div class="hero">
  <div id="ip-wrapper" onclick="copyIP()" title="Click to copy">
    <div id="ip-display"><span class="skel" style="width:220px;height:1.1em;display:inline-block;vertical-align:middle"></span></div>
    <div id="copy-hint">click to copy</div>
  </div>
  <div class="hero-sub" id="hero-sub"><span class="skel" style="width:200px"></span></div>
  <div class="status-row" id="status-row"></div>
</div>

<!-- ROW 1: IP info -->
<div class="grid">
  <div class="card" id="card-location">
    <div class="card-title">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
      Location
    </div>
    <div class="skel skel-block"></div>
  </div>
  <div class="card" id="card-network">
    <div class="card-title">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
      Network
    </div>
    <div class="skel skel-block"></div>
  </div>
  <div class="card" id="card-privacy">
    <div class="card-title">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      Privacy Checks
    </div>
    <div class="skel skel-block"></div>
  </div>
  <div class="card" id="card-browser">
    <div class="card-title">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
      Your Browser
    </div>
    <div class="skel skel-block"></div>
  </div>
</div>

<!-- ROW 2: Advanced -->
<div class="grid-2">

  <!-- IPv6 & Routing -->
  <div class="card" id="card-ipv6">
    <div class="card-title">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
      IPv6 &amp; Routing
      <span class="note">— IPv6 leaks can expose you even behind a VPN</span>
    </div>
    <div class="skel skel-block"></div>
  </div>

  <!-- Fingerprint -->
  <div class="card" id="card-fingerprint">
    <div class="card-title">
      <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z"/><path d="M12 8v4l3 3"/></svg>
      Browser Fingerprint
      <span class="note">— how sites track you beyond your IP</span>
    </div>
    <div class="skel skel-block"></div>
  </div>

</div>

<!-- ROW 3: What the server sees -->
<div class="card" id="card-headers" style="margin-bottom:1rem">
  <div class="card-title">
    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
    What the Server Sees
    <span class="note">— HTTP headers your browser sends automatically with every request</span>
  </div>
  <div class="skel skel-block"></div>
</div>

<!-- ROW 4: WebRTC -->
<div class="card" id="card-webrtc" style="margin-bottom:1rem">
  <div class="card-title">
    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.93a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16.92z"/></svg>
    WebRTC Leak Test
    <span class="note">— probes for IPs your browser exposes via peer-to-peer, even behind a VPN</span>
  </div>
  <div id="webrtc-result"><span class="skel" style="width:200px"></span></div>
</div>

<!-- FOOTER -->
<footer>
  <div class="footer-grid">
    <div>
      <h3>How this works</h3>
      When you hit Refresh, your IP is looked up once via ip-api.com (server-side, so HTTP→HTTPS is handled for you) and Cloudflare's trace API. Browser fingerprint data is computed entirely in your browser and never sent anywhere. WebRTC uses a public STUN server to discover locally-bound IPs.
    </div>
    <div>
      <h3>What we don't do</h3>
      This server has no database and writes no logs. It does not set cookies, load analytics, or include any third-party scripts. Every check runs on demand — closing this tab leaves no trace on our end.
    </div>
    <div>
      <h3>Data sources</h3>
      IP geolocation &amp; proxy detection: <a href="https://ip-api.com" target="_blank" rel="noopener">ip-api.com</a><br>
      Routing cross-check: <a href="https://1.1.1.1/cdn-cgi/trace" target="_blank" rel="noopener">Cloudflare trace</a><br>
      IPv6 detection: <a href="https://ipv6.icanhazip.com" target="_blank" rel="noopener">ipv6.icanhazip.com</a><br>
      WebRTC: Google STUN (stun.l.google.com)
    </div>
  </div>
</footer>

</div><!-- /wrap -->
<script>
/* ── utils ── */
function flag(code) {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}
function row(label, val, mono = false) {
  if (val === null || val === undefined || val === '') return '';
  return \`<div class="row"><span class="row-label">\${label}</span><span class="row-val\${mono?' mono':''}">\${val}</span></div>\`;
}
function indicator(icon, label, desc, type) {
  return \`<div class="indicator"><div class="ind-icon \${type}">\${icon}</div><div class="ind-label">\${label}\${desc?\`<small>\${esc(desc)}</small>\`:''}</div></div>\`;
}
function badge(text, type) {
  return \`<span class="badge \${type}"><span class="dot"></span>\${text}</span>\`;
}
function esc(s) {
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function cardTitle(svgPath, title, note) {
  return \`<div class="card-title">\${svgPath}\${esc(title)}\${note?\`<span class="note">— \${note}</span>\`:''}</div>\`;
}
const LOC_ICON = \`<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>\`;
const NET_ICON = \`<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>\`;
const SHIELD_ICON = \`<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>\`;
const SCREEN_ICON = \`<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>\`;

/* ── state ── */
let currentIP = '';

/* ── WebRTC ── */
async function getWebRTCIPs() {
  return new Promise(resolve => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.createDataChannel('');
      const pub = new Set(), lan = new Set();
      const isPrivate = ip =>
        ip.startsWith('192.168.') || ip.startsWith('10.') ||
        ip.startsWith('172.') || ip.startsWith('169.254.') || ip === '127.0.0.1';

      pc.onicecandidate = e => {
        if (!e?.candidate) { pc.close(); resolve({ pub:[...pub], lan:[...lan] }); return; }
        const m = e.candidate.candidate.match(/([0-9]{1,3}(?:\\.[0-9]{1,3}){3})/g);
        (m||[]).forEach(ip => isPrivate(ip) ? lan.add(ip) : pub.add(ip));
      };
      pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => resolve({ pub:[], lan:[] }));
      setTimeout(() => { try{pc.close();}catch{} resolve({ pub:[...pub], lan:[...lan] }); }, 3000);
    } catch { resolve({ pub:[], lan:[] }); }
  });
}

/* ── IPv6 ── */
async function getIPv6() {
  try {
    const res = await fetch('https://ipv6.icanhazip.com', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const t = (await res.text()).trim();
    return t.includes(':') ? t : null;
  } catch { return null; }
}

/* ── Cloudflare trace ── */
async function getCFTrace() {
  try {
    const res = await fetch('https://1.1.1.1/cdn-cgi/trace', { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const obj = {};
    (await res.text()).split('\\n').forEach(l => {
      const i = l.indexOf('=');
      if (i > 0) obj[l.slice(0,i)] = l.slice(i+1);
    });
    return obj;
  } catch { return null; }
}

/* ── Browser fingerprint ── */
function getWebGL() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
    if (!gl) return null;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    };
  } catch { return null; }
}

async function getCanvasHash() {
  try {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 60;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0,0,240,60);
    ctx.font = 'bold 14px Arial'; ctx.fillStyle = '#60a5fa';
    ctx.fillText('Privacy Check 🔒', 10, 22);
    ctx.font = '11px monospace'; ctx.fillStyle = '#4ade80';
    ctx.fillText('canvas fingerprint test 1234', 10, 44);
    const data = c.toDataURL();
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
    return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,24);
  } catch { return null; }
}

function getColorGamut() {
  if (matchMedia('(color-gamut: rec2020)').matches) return 'rec2020';
  if (matchMedia('(color-gamut: p3)').matches) return 'p3 (wide)';
  if (matchMedia('(color-gamut: srgb)').matches) return 'sRGB';
  return 'unknown';
}

/* ── Renders ── */
function renderHero(d, isVPN) {
  document.getElementById('ip-display').textContent = d.query || 'Unknown';
  document.getElementById('copy-hint').textContent = 'click to copy';
  currentIP = d.query || '';
  const f = flag(d.countryCode);
  document.getElementById('hero-sub').textContent =
    [d.isp, [f, d.city, d.country].filter(Boolean).join(' ')].filter(Boolean).join(' · ');
  const badges = [];
  if (isVPN) badges.push(badge('VPN / Proxy Detected', 'risk'));
  else if (d.hosting) badges.push(badge('Datacenter IP', 'warn'));
  else badges.push(badge('No VPN Detected', 'clean'));
  if (d.mobile) badges.push(badge('Mobile', 'info'));
  document.getElementById('status-row').innerHTML = badges.join('');
}

function renderLocation(d) {
  const f = flag(d.countryCode);
  document.getElementById('card-location').innerHTML = cardTitle(LOC_ICON,'Location') +
    row('Country', f ? \`\${f} \${esc(d.country)}\` : esc(d.country)) +
    row('City', esc(d.city)) +
    row('Region', esc(d.regionName)) +
    row('Postal', esc(d.zip)) +
    row('Timezone', esc(d.timezone)) +
    row('Coordinates', d.lat != null ? \`\${d.lat.toFixed(3)}, \${d.lon.toFixed(3)}\` : '');
}

function renderNetwork(d) {
  document.getElementById('card-network').innerHTML = cardTitle(NET_ICON,'Network') +
    row('ISP', esc(d.isp)) +
    row('Organization', esc(d.org)) +
    row('AS Number', esc(d.as)) +
    row('AS Name', esc(d.asname)) +
    row('Reverse DNS', esc(d.reverse) || '—', true) +
    row('Mobile', d.mobile ? 'Yes' : 'No');
}

function renderPrivacy(d, webrtc) {
  const isProxy = d.proxy === true;
  const isHosting = d.hosting === true;
  const ispText = ((d.isp||'') + ' ' + (d.org||'') + ' ' + (d.asname||'')).toLowerCase();
  const ispSuggestsVPN = ['vpn','proxy','anonymi','vps','virtual private'].some(k => ispText.includes(k));
  const ispSuggestsHosting = ['hosting','cloud','digitalocean','linode','vultr','amazon','google cloud','azure','hetzner','ovh','datacenter','colocation','serverius'].some(k => ispText.includes(k));
  const webrtcLeak = webrtc.pub.length > 0 && !webrtc.pub.includes(d.query);

  const items = [];
  if (isProxy || ispSuggestsVPN) {
    items.push(indicator('✕','VPN / Proxy Detected',
      isProxy ? 'This IP is a known proxy or VPN exit node' : 'ISP name matches a known VPN provider', 'bad'));
  } else {
    items.push(indicator('✓','No Known VPN / Proxy','Not flagged as a proxy, VPN, or anonymizer','ok'));
  }
  if (isHosting || ispSuggestsHosting) {
    items.push(indicator('⚠','Datacenter / Cloud IP','Traffic routes through a commercial hosting network — common with VPNs','warn'));
  } else {
    items.push(indicator('✓','Residential / ISP IP','Not a datacenter or cloud provider network','ok'));
  }
  if (webrtcLeak) {
    items.push(indicator('⚠','WebRTC Leak','Real IP is visible via browser WebRTC — your VPN does not block it','warn'));
  } else if (webrtc.pub.length === 0) {
    items.push(indicator('✓','WebRTC Blocked or No Leak','No public IPs were exposed via WebRTC','ok'));
  } else {
    items.push(indicator('✓','No WebRTC Leak','WebRTC IP matches your public IP','ok'));
  }
  if (d.mobile) items.push(indicator('i','Mobile / Cellular Network','','neutral'));

  document.getElementById('card-privacy').innerHTML = cardTitle(SHIELD_ICON,'Privacy Checks') + items.join('');
}

function renderBrowser(ipTimezone) {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzMatch = !ipTimezone || browserTz === ipTimezone;
  const dnt = navigator.doNotTrack === '1' ? 'Enabled' : navigator.doNotTrack === '0' ? 'Disabled' : 'Not set';
  const tzRow = \`<div class="row"><span class="row-label">Timezone</span>
    <span class="row-val">\${esc(browserTz)}\${!tzMatch?' <span style="color:var(--yellow)">⚠</span>':''}</span></div>\`;
  const tzNote = !tzMatch
    ? \`<div class="tz-mismatch">⚠ Mismatch — browser is set to <strong>\${esc(browserTz)}</strong> but your IP resolves to <strong>\${esc(ipTimezone)}</strong>. Timezone spoofing or VPN mismatch.</div>\`
    : '';
  document.getElementById('card-browser').innerHTML = cardTitle(SCREEN_ICON,'Your Browser') +
    tzRow + tzNote +
    row('Language', esc(navigator.language)) +
    row('All Languages', esc((navigator.languages||[navigator.language]).join(', '))) +
    row('Do Not Track', dnt) +
    row('Cookies', navigator.cookieEnabled ? 'Enabled' : 'Disabled') +
    \`<div class="row"><span class="row-label">User Agent</span></div><div class="ua-text">\${esc(navigator.userAgent)}</div>\`;
}

function renderIPv6(ipv6, cfTrace, publicIPv4) {
  const el = document.getElementById('card-ipv6');
  const ICON = \`<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>\`;
  let html = cardTitle(ICON, 'IPv6 & Routing');

  if (ipv6) {
    const isLeak = publicIPv4 && ipv6; // if you have both, VPN may only tunnel IPv4
    html += \`<div class="indicator">
      <div class="ind-icon \${isLeak ? 'warn' : 'ok'}">\${isLeak ? '⚠' : '✓'}</div>
      <div class="ind-label">IPv6 address detected\${isLeak ? '<small>Your VPN may not be tunneling IPv6 — this address could be your real IP</small>' : '<small>IPv6 is tunneled alongside your IPv4 connection</small>'}</div>
    </div>\`;
    html += row('IPv6 Address', \`<span style="font-family:monospace;font-size:.8rem;word-break:break-all">\${esc(ipv6)}</span>\`);
  } else {
    html += indicator('✓', 'No IPv6 detected', 'Either your connection is IPv4-only, or your VPN is correctly blocking IPv6', 'ok');
  }

  if (cfTrace) {
    const warp = cfTrace.warp === 'on';
    const gateway = cfTrace.gateway === 'on';
    html += \`<div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid rgba(255,255,255,.04)">\`;
    html += indicator(
      warp || gateway ? '✓' : 'i',
      warp ? 'Cloudflare WARP active' : gateway ? 'Cloudflare Gateway active' : 'Cloudflare WARP not detected',
      warp ? 'Your traffic is routed through Cloudflare WARP VPN' : '',
      warp || gateway ? 'ok' : 'neutral'
    );
    if (cfTrace.colo) html += row('Nearest CF datacenter', esc(cfTrace.colo));
    if (cfTrace.loc)  html += row('CF sees country', \`\${flag(cfTrace.loc)} \${esc(cfTrace.loc)}\`);
    if (cfTrace.http) html += row('HTTP protocol', esc(cfTrace.http));
    html += \`</div>\`;
  }

  el.innerHTML = html;
}

async function renderFingerprint() {
  const el = document.getElementById('card-fingerprint');
  const FP_ICON = \`<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z"/><path d="M12 8v4l3 3"/></svg>\`;

  const [canvasHash, webgl] = await Promise.all([getCanvasHash(), Promise.resolve(getWebGL())]);

  const mem = navigator.deviceMemory ? \`\${navigator.deviceMemory} GB\` : null;
  const cpu = navigator.hardwareConcurrency ? \`\${navigator.hardwareConcurrency} threads\` : null;
  const screen_ = \`\${screen.width}×\${screen.height} @ \${screen.colorDepth}-bit\`;
  const dpr = window.devicePixelRatio ? \`\${window.devicePixelRatio}×\` : null;
  const touch = navigator.maxTouchPoints > 0 ? \`Yes (\${navigator.maxTouchPoints} points)\` : 'No';
  const gamut = getColorGamut();
  const hdr = matchMedia('(dynamic-range: high)').matches ? 'Yes' : 'No';

  let html = cardTitle(FP_ICON, 'Browser Fingerprint', 'how sites track you beyond your IP');

  if (canvasHash) {
    html += \`<div class="fp-hash">
      <span class="fp-hash-label">Canvas fingerprint</span>
      <span class="fp-hash-val">\${canvasHash}…</span>
    </div>\`;
  }

  if (webgl) {
    html += row('GPU Renderer', esc(webgl.renderer));
    html += row('GPU Vendor', esc(webgl.vendor));
  }
  html += row('Screen', esc(screen_));
  if (dpr) html += row('Device pixel ratio', dpr);
  if (cpu) html += row('CPU threads', cpu);
  if (mem) html += row('Device memory', mem);
  html += row('Touch support', touch);
  html += row('Color gamut', gamut);
  html += row('HDR', hdr);
  html += row('Platform', esc(navigator.platform || 'Not exposed'));

  el.innerHTML = html;
}

function renderHeaders(headers) {
  const el = document.getElementById('card-headers');
  const HDR_ICON = \`<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>\`;

  // Interesting ones first
  const PRIORITY = ['user-agent','accept-language','sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-platform','sec-fetch-site','sec-fetch-mode','dnt','referer'];
  const entries = Object.entries(headers);
  entries.sort(([a],[b]) => {
    const ai = PRIORITY.indexOf(a), bi = PRIORITY.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const rows = entries.map(([k,v]) =>
    \`<div class="header-row"><span class="header-key">\${esc(k)}</span><span class="header-val">\${esc(Array.isArray(v) ? v.join(', ') : v)}</span></div>\`
  ).join('');

  el.innerHTML = cardTitle(HDR_ICON, 'What the Server Sees', 'HTTP headers your browser sends automatically with every request') +
    \`<p style="font-size:.78rem;color:var(--muted);margin-bottom:.75rem">These are sent with <em>every</em> HTTP request you make — to every website you visit.</p>\` +
    rows;
}

function renderWebRTC(webrtc, publicIP) {
  const el = document.getElementById('webrtc-result');
  const { pub, lan } = webrtc;
  const leak = pub.some(ip => ip !== publicIP);

  let html = '';
  if (pub.length === 0 && lan.length === 0) {
    html = badge('No IPs exposed — WebRTC may be blocked by your browser or an extension', 'clean');
  } else {
    html += leak ? badge('Public IP leak detected', 'risk') : badge('No public IP leak', 'clean');
    if (pub.length > 0) {
      html += \`<div style="margin-top:.75rem"><div style="font-size:.75rem;color:var(--muted);margin-bottom:.35rem;text-transform:uppercase;letter-spacing:.06em">Public IPs</div>
        <div class="ip-tag-list">\${pub.map(ip => \`<span class="ip-tag \${ip !== publicIP ? 'leak' : ''}">\${esc(ip)}\${ip !== publicIP ? ' ← real IP' : ' ← matches'}</span>\`).join('')}</div></div>\`;
    }
    if (lan.length > 0) {
      html += \`<div style="margin-top:.75rem"><div style="font-size:.75rem;color:var(--muted);margin-bottom:.35rem;text-transform:uppercase;letter-spacing:.06em">Local / LAN IPs <span style="font-size:.7rem;color:var(--dim)">(your device's internal addresses — visible to any site)</span></div>
        <div class="ip-tag-list">\${lan.map(ip => \`<span class="ip-tag local">\${esc(ip)}</span>\`).join('')}</div></div>\`;
    }
    if (leak) {
      html += \`<p style="font-size:.8rem;color:var(--muted);margin-top:.75rem">Your VPN does not block WebRTC. Websites can see your real IP address without making any HTTP request.</p>\`;
    }
  }
  el.innerHTML = html;
}

/* ── load ── */
async function load() {
  const btn = document.getElementById('refresh-btn');
  btn.textContent = '↺';
  btn.classList.add('spinning');

  // reset skeletons
  document.getElementById('ip-display').innerHTML = '<span class="skel" style="width:220px;height:1.1em;display:inline-block;vertical-align:middle"></span>';
  document.getElementById('copy-hint').textContent = '';
  document.getElementById('hero-sub').innerHTML = '<span class="skel" style="width:200px"></span>';
  document.getElementById('status-row').innerHTML = '';
  ['card-location','card-network','card-privacy','card-browser','card-ipv6'].forEach(id => {
    document.getElementById(id).innerHTML = '<div class="skel skel-block"></div>';
  });
  document.getElementById('card-fingerprint').innerHTML = '<div class="skel skel-block"></div>';
  document.getElementById('card-headers').innerHTML = '<div class="skel skel-block"></div>';
  document.getElementById('webrtc-result').innerHTML = '<span class="skel" style="width:200px"></span>';

  const [data, webrtc, ipv6, cfTrace, headers] = await Promise.all([
    fetch('/api/info').then(r => r.json()).catch(() => ({})),
    getWebRTCIPs(),
    getIPv6(),
    getCFTrace(),
    fetch('/api/headers').then(r => r.json()).catch(() => ({})),
  ]);

  const isVPN = data.proxy === true ||
    ['vpn','proxy','anonymi','virtual private'].some(k =>
      ((data.isp||'') + ' ' + (data.org||'')).toLowerCase().includes(k));

  renderHero(data, isVPN);
  renderLocation(data);
  renderNetwork(data);
  renderPrivacy(data, webrtc);
  renderBrowser(data.timezone);
  renderIPv6(ipv6, cfTrace, data.query);
  renderFingerprint(); // async internally, no await needed
  renderHeaders(headers);
  renderWebRTC(webrtc, data.query);

  btn.classList.remove('spinning');
  btn.textContent = '↺';
}

function copyIP() {
  if (!currentIP) return;
  navigator.clipboard.writeText(currentIP).then(() => {
    const hint = document.getElementById('copy-hint');
    hint.textContent = 'copied ✓';
    hint.style.color = 'var(--green)';
    setTimeout(() => {
      hint.textContent = 'click to copy';
      hint.style.color = '';
    }, 1800);
  });
}

load();
</script>
</body>
</html>`;
