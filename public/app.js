/* ── utils ── */
function flag(code) {
  if (!code || code.length !== 2) return '';
  return code.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
}
function row(label, val, mono = false) {
  if (val === null || val === undefined || val === '') return '';
  return `<div class="row"><span class="row-label">${label}</span><span class="row-val${mono?' mono':''}">${val}</span></div>`;
}
function indicator(icon, label, desc, type) {
  return `<div class="indicator"><div class="ind-icon ${type}">${icon}</div><div class="ind-label">${label}${desc?`<small>${esc(desc)}</small>`:''}</div></div>`;
}
function badge(text, type) {
  return `<span class="badge ${type}"><span class="dot"></span>${text}</span>`;
}
function esc(s) {
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function cardTitle(svgPath, title, note) {
  return `<div class="card-title">${svgPath}${esc(title)}${note?`<span class="note">— ${note}</span>`:''}</div>`;
}
function sourceNote(items) {
  return `<div class="source-note">${items.map(item => `<span>${esc(item)}</span>`).join('')}</div>`;
}
function unavailable(label, detail) {
  return indicator('i', label, detail, 'neutral');
}
function isSuccessfulLookup(d) {
  return d?.status === 'success' && !!d.query;
}
const LOC_ICON = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>`;
const NET_ICON = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
const SHIELD_ICON = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`;
const SCREEN_ICON = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>`;

/* ── state ── */
let currentIP = '';
let latestReport = null;

/* ── WebRTC ── */
function isPrivateIp(ip) {
  if (ip.includes(':')) {
    const lower = ip.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
  }

  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return false;
  const [a, b] = parts;
  return a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168);
}

function parseIceCandidate(candidate) {
  const parts = candidate.trim().split(/\s+/);
  const typIndex = parts.indexOf('typ');
  if (parts.length < 8 || typIndex === -1) return null;
  return {
    address: parts[4],
    type: parts[typIndex + 1] || 'unknown',
  };
}

async function getWebRTCIPs() {
  return new Promise(resolve => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.createDataChannel('');
      const pub = new Set(), lan = new Set(), relay = new Set();
      const candidates = new Map();
      let mdns = 0;
      const addCandidate = (type, address, scope) => {
        candidates.set(`${type}|${address}|${scope}`, { type, address, scope });
      };
      const done = () => ({ pub:[...pub], lan:[...lan], relay:[...relay], mdns, candidates:[...candidates.values()] });

      pc.onicecandidate = e => {
        if (!e?.candidate) { pc.close(); resolve(done()); return; }
        const parsed = parseIceCandidate(e.candidate.candidate);
        if (!parsed) return;
        if (parsed.address.endsWith('.local')) {
          mdns += 1;
          addCandidate(parsed.type, parsed.address, 'mDNS masked');
          return;
        }
        if (parsed.type === 'relay') {
          relay.add(parsed.address);
          addCandidate(parsed.type, parsed.address, 'relay');
          return;
        }
        const isPrivate = isPrivateIp(parsed.address);
        (isPrivate ? lan : pub).add(parsed.address);
        addCandidate(parsed.type, parsed.address, isPrivate ? 'private' : 'public');
      };
      pc.createOffer().then(o => pc.setLocalDescription(o)).catch(() => resolve(done()));
      setTimeout(() => { try{pc.close();}catch{} resolve(done()); }, 3000);
    } catch { resolve({ pub:[], lan:[], relay:[], mdns:0, candidates:[] }); }
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
    (await res.text()).split('\n').forEach(l => {
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
function renderHero(d, isVPN, ipv6, ipv6Info) {
  const hasLookup = isSuccessfulLookup(d);
  document.getElementById('ip-display').textContent = hasLookup ? d.query : 'Unavailable';
  document.getElementById('copy-hint').textContent = hasLookup ? 'click to copy' : 'try refresh';
  currentIP = d.query || '';
  const f = flag(d.countryCode);
  document.getElementById('hero-sub').textContent =
    hasLookup ? [d.isp, [f, d.city, d.country].filter(Boolean).join(' ')].filter(Boolean).join(' · ') : 'IP lookup failed or returned no usable result';
  const badges = [];
  if (!hasLookup) badges.push(badge('Lookup Unavailable', 'neutral'));
  else if (isVPN) badges.push(badge('VPN / Proxy Signal', 'risk'));
  else if (d.hosting) badges.push(badge('Datacenter IP', 'warn'));
  else badges.push(badge('No VPN Signal', 'clean'));
  if (hasLookup && d.mobile) badges.push(badge('Mobile', 'info'));
  document.getElementById('status-row').innerHTML = badges.join('');

  const ipCards = [];
  if (hasLookup) {
    ipCards.push(`<div class="hero-ip-card">
      <div class="hero-ip-label">HTTP route</div>
      <div class="hero-ip-value">${esc(d.query)}</div>
      <div class="hero-ip-meta">${esc(networkLabel(d) || 'network unavailable')}</div>
    </div>`);
  }
  if (ipv6) {
    ipCards.push(`<div class="hero-ip-card">
      <div class="hero-ip-label">IPv6 / browser route</div>
      <div class="hero-ip-value">${esc(ipv6)}</div>
      <div class="hero-ip-meta">${esc(ipv6Info?.status === 'success' ? networkLabel(ipv6Info) : 'lookup unavailable')}</div>
    </div>`);
  }
  document.getElementById('hero-ip-grid').innerHTML = ipCards.length > 1 ? ipCards.join('') : '';
}

function renderLocation(d) {
  if (!isSuccessfulLookup(d)) {
    document.getElementById('card-location').innerHTML = cardTitle(LOC_ICON,'Location') +
      unavailable('Location unavailable', 'The IP geolocation lookup did not return a usable result.') +
      sourceNote(['source: ip-api', 'confidence: unavailable']);
    return;
  }

  const f = flag(d.countryCode);
  document.getElementById('card-location').innerHTML = cardTitle(LOC_ICON,'Location') +
    row('Country', f ? `${f} ${esc(d.country)}` : esc(d.country)) +
    row('City', esc(d.city)) +
    row('Region', esc(d.regionName)) +
    row('Postal', esc(d.zip)) +
    row('Timezone', esc(d.timezone)) +
    row('Coordinates', d.lat != null ? `${d.lat.toFixed(3)}, ${d.lon.toFixed(3)}` : '') +
    sourceNote(['source: ip-api', 'confidence: approximate']);
}

function renderNetwork(d) {
  if (!isSuccessfulLookup(d)) {
    document.getElementById('card-network').innerHTML = cardTitle(NET_ICON,'Network') +
      unavailable('Network unavailable', 'ASN and provider details depend on the IP lookup result.') +
      sourceNote(['source: ip-api', 'confidence: unavailable']);
    return;
  }

  document.getElementById('card-network').innerHTML = cardTitle(NET_ICON,'Network') +
    row('ISP', esc(d.isp)) +
    row('Organization', esc(d.org)) +
    row('AS Number', esc(d.as)) +
    row('AS Name', esc(d.asname)) +
    row('Reverse DNS', esc(d.reverse) || '—', true) +
    row('Mobile', d.mobile ? 'Yes' : 'No') +
    sourceNote(['source: ip-api', 'confidence: registry/database']);
}

function formatPlace(d) {
  return [d.city, d.regionName, d.country].filter(Boolean).join(', ');
}

function networkLabel(d) {
  return [d.asname, d.org || d.isp].filter(Boolean).join(' / ');
}

function renderPrivacy(d, webrtc) {
  if (!isSuccessfulLookup(d)) {
    document.getElementById('card-privacy').innerHTML = cardTitle(SHIELD_ICON,'Privacy Checks') +
      unavailable('Privacy checks limited', 'Proxy, hosting, and mobile signals need a successful IP lookup.') +
      sourceNote(['sources: ip-api, browser WebRTC', 'confidence: partial']);
    return;
  }

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
    items.push(indicator('✓','Not flagged as hosting','This IP is not identified as a datacenter or cloud network by the lookup source','ok'));
  }
  if (webrtcLeak) {
    items.push(indicator('⚠','WebRTC public IP differs','WebRTC exposed a public IP that does not match the HTTP IP. This can indicate a VPN or routing leak.','warn'));
  } else if (webrtc.pub.length === 0) {
    const mdnsNote = webrtc.mdns ? 'Local candidates were masked with mDNS hostnames by the browser' : 'No public IPs were exposed via WebRTC';
    items.push(indicator('✓','WebRTC Blocked or No Public Leak', mdnsNote, 'ok'));
  } else {
    items.push(indicator('✓','No WebRTC Leak','WebRTC IP matches your public IP','ok'));
  }
  if (d.mobile) items.push(indicator('i','Mobile / Cellular Network','','neutral'));

  document.getElementById('card-privacy').innerHTML = cardTitle(SHIELD_ICON,'Privacy Checks') + items.join('') +
    sourceNote(['sources: ip-api, browser WebRTC', 'confidence: database + heuristic']);
}

function renderBrowser(ipTimezone) {
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzMatch = !ipTimezone || browserTz === ipTimezone;
  const dnt = navigator.doNotTrack === '1' ? 'Enabled' : navigator.doNotTrack === '0' ? 'Disabled' : 'Not set';
  const tzRow = `<div class="row"><span class="row-label">Timezone</span>
    <span class="row-val">${esc(browserTz)}${!tzMatch?' <span class="tz-warning">⚠</span>':''}</span></div>`;
  const tzNote = !tzMatch
    ? `<div class="tz-mismatch">⚠ Mismatch — browser is set to <strong>${esc(browserTz)}</strong> but your IP resolves to <strong>${esc(ipTimezone)}</strong>. Timezone spoofing or VPN mismatch.</div>`
    : '';
  document.getElementById('card-browser').innerHTML = cardTitle(SCREEN_ICON,'Your Browser') +
    tzRow + tzNote +
    row('Language', esc(navigator.language)) +
    row('All Languages', esc((navigator.languages||[navigator.language]).join(', '))) +
    row('Do Not Track', dnt) +
    row('Cookies', navigator.cookieEnabled ? 'Enabled' : 'Disabled') +
    `<div class="row row-stack"><span class="row-label">User Agent</span><span class="ua-text">${esc(navigator.userAgent)}</span></div>` +
    sourceNote(['source: browser APIs', 'confidence: browser-reported']);
}

function renderIPv6(ipv6, ipv6Info, cfTrace, publicIPv4Info) {
  const el = document.getElementById('card-ipv6');
  const ICON = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
  let html = cardTitle(ICON, 'IPv6 & Routing');

  if (ipv6) {
    const countryDiffers = ipv6Info?.countryCode && publicIPv4Info?.countryCode && ipv6Info.countryCode !== publicIPv4Info.countryCode;
    const asDiffers = ipv6Info?.as && publicIPv4Info?.as && ipv6Info.as !== publicIPv4Info.as;
    const mismatch = countryDiffers || asDiffers;
    html += `<div class="indicator">
      <div class="ind-icon ${mismatch ? 'warn' : 'neutral'}">${mismatch ? '⚠' : 'i'}</div>
      <div class="ind-label">IPv6 address detected<small>${mismatch ? 'IPv4 and IPv6 appear to exit through different networks or countries. That can be a VPN leak signal.' : 'IPv6 is reachable from this browser. That is normal unless it bypasses the network you expected.'}</small></div>
    </div>`;
    html += row('IPv6 Address', `<span class="inline-mono">${esc(ipv6)}</span>`);
    if (ipv6Info?.status === 'success') {
      html += row('IPv6 location', esc(formatPlace(ipv6Info)));
      html += row('IPv6 network', esc(networkLabel(ipv6Info)));
    }
    if (publicIPv4Info?.query) {
      html += row('IPv4 network', esc(networkLabel(publicIPv4Info)));
    }
  } else {
    html += indicator('i', 'No IPv6 detected', 'This browser did not reach the IPv6-only test endpoint. Your connection may be IPv4-only, or IPv6 may be disabled or blocked.', 'neutral');
  }

  if (cfTrace) {
    const warp = cfTrace.warp === 'on';
    const gateway = cfTrace.gateway === 'on';
    html += `<div class="div-sep">`;
    html += indicator(
      warp || gateway ? '✓' : 'i',
      warp ? 'Cloudflare WARP active' : gateway ? 'Cloudflare Gateway active' : 'Cloudflare WARP not detected',
      warp ? 'Your traffic is routed through Cloudflare WARP VPN' : '',
      warp || gateway ? 'ok' : 'neutral'
    );
    if (cfTrace.colo) html += row('Nearest CF datacenter', esc(cfTrace.colo));
    if (cfTrace.loc)  html += row('CF sees country', `${flag(cfTrace.loc)} ${esc(cfTrace.loc)}`);
    if (cfTrace.http) html += row('HTTP protocol', esc(cfTrace.http));
    html += `</div>`;
  } else {
    html += unavailable('Cloudflare trace unavailable', 'Routing cross-check could not be reached from this browser.');
  }

  el.innerHTML = html + sourceNote(['sources: icanhazip, ip-api, Cloudflare trace', 'confidence: observed + database']);
}

async function renderFingerprint() {
  const el = document.getElementById('card-fingerprint');
  const FP_ICON = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22C6.48 22 2 17.52 2 12S6.48 2 12 2s10 4.48 10 10-4.48 10-10 10z"/><path d="M12 8v4l3 3"/></svg>`;

  const [canvasHash, webgl] = await Promise.all([getCanvasHash(), Promise.resolve(getWebGL())]);

  const mem = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : null;
  const cpu = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} threads` : null;
  const screen_ = `${screen.width}×${screen.height} @ ${screen.colorDepth}-bit`;
  const dpr = window.devicePixelRatio ? `${window.devicePixelRatio}×` : null;
  const touch = navigator.maxTouchPoints > 0 ? `Yes (${navigator.maxTouchPoints} points)` : 'No';
  const gamut = getColorGamut();
  const hdr = matchMedia('(dynamic-range: high)').matches ? 'Yes' : 'No';

  let html = cardTitle(FP_ICON, 'Browser Fingerprint', 'how sites track you beyond your IP');

  if (canvasHash) {
    html += `<div class="fp-hash">
      <span class="fp-hash-label">Canvas fingerprint</span>
      <span class="fp-hash-val">${canvasHash}…</span>
    </div>`;
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

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    html += `<div class="div-sep">`;
    html += `<div class="subsection-label">Connection — also a tracking signal</div>`;
    if (conn.type)          html += row('Type',           esc(conn.type));
    if (conn.effectiveType) html += row('Effective type', esc(conn.effectiveType));
    if (conn.downlink != null) html += row('Est. downlink', `${conn.downlink} Mbps`);
    if (conn.rtt != null)   html += row('RTT',            `${conn.rtt} ms`);
    if (conn.saveData != null) html += row('Data saver',  conn.saveData ? 'On' : 'Off');
    html += `</div>`;
  }

  el.innerHTML = html + sourceNote(['source: browser APIs', 'confidence: browser-reported']);
}

function renderHeaders(headers) {
  const el = document.getElementById('card-headers');
  const HDR_ICON = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>`;

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
    `<div class="header-row"><span class="header-key">${esc(k)}</span><span class="header-val">${esc(Array.isArray(v) ? v.join(', ') : v)}</span></div>`
  ).join('');

  el.innerHTML = cardTitle(HDR_ICON, 'What the Server Sees', 'HTTP headers your browser sends automatically with every request') +
    `<p class="headers-intro">These headers were sent to this page. Other sites may receive a slightly different set depending on browser policy, permissions, and server opt-ins.</p>` +
    (rows || unavailable('Headers unavailable', 'The headers endpoint did not return any visible headers.')) +
    sourceNote(['source: this server', 'confidence: observed for this request']);
}

function renderWebRTC(webrtc, publicIP) {
  const el = document.getElementById('webrtc-result');
  const { pub = [], lan = [], relay = [], mdns = 0, candidates = [] } = webrtc;
  const leak = pub.some(ip => ip !== publicIP);

  let html = '';
  if (pub.length === 0 && lan.length === 0 && relay.length === 0 && mdns === 0) {
    html = badge('No IP candidates exposed — WebRTC may be blocked or unavailable', 'clean');
  } else {
    html += leak ? badge('Different public IP exposed', 'risk') : badge('No different public IP exposed', 'clean');
    if (pub.length > 0) {
      html += `<div class="ip-group"><div class="ip-group-title">Public IPs</div>
        <div class="ip-tag-list">${pub.map(ip => `<span class="ip-tag ${ip !== publicIP ? 'leak' : ''}">${esc(ip)}${ip !== publicIP ? ' ← differs' : ' ← matches HTTP'}</span>`).join('')}</div></div>`;
    }
    if (lan.length > 0) {
      html += `<div class="ip-group"><div class="ip-group-title">Local / LAN IPs <span class="ip-group-note">(private network addresses exposed by this browser)</span></div>
        <div class="ip-tag-list">${lan.map(ip => `<span class="ip-tag local">${esc(ip)}</span>`).join('')}</div></div>`;
    }
    if (relay.length > 0) {
      html += `<div class="ip-group"><div class="ip-group-title">Relay candidates <span class="ip-group-note">(TURN relay addresses, not your device IP)</span></div>
        <div class="ip-tag-list">${relay.map(ip => `<span class="ip-tag">${esc(ip)}</span>`).join('')}</div></div>`;
    }
    if (mdns > 0) {
      html += `<p class="leak-note">${mdns} local candidate${mdns === 1 ? ' was' : 's were'} hidden behind browser mDNS privacy masking.</p>`;
    }
    if (candidates.length > 0) {
      html += `<div class="candidate-table">
        ${candidates.map(c => `<div class="candidate-row">
          <span class="candidate-kind">${esc(c.type)}</span>
          <span class="candidate-address">${esc(c.address)}</span>
          <span class="candidate-scope">${esc(c.scope)}</span>
        </div>`).join('')}
      </div>`;
    }
    if (leak) {
      html += `<p class="leak-note">WebRTC exposed a public address that is different from the one seen by normal HTTP requests. If you expected all traffic to use one VPN exit, check your browser or VPN WebRTC leak protection.</p>`;
    }
  }
  el.innerHTML = html + sourceNote(['source: browser WebRTC ICE candidates', 'confidence: observed in this browser']);
}

function redactIp(ip) {
  if (!ip) return null;
  if (ip.includes(':')) {
    const parts = ip.split(':').filter(Boolean);
    return parts.length > 2 ? `${parts.slice(0, 2).join(':')}:…` : 'IPv6 redacted';
  }
  const parts = ip.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.x.x` : 'IP redacted';
}

function buildReport(data, webrtc, ipv6, ipv6Info, cfTrace, headers) {
  return {
    generatedAt: new Date().toISOString(),
    httpIp: redactIp(data.query),
    httpNetwork: networkLabel(data) || null,
    httpCountry: data.countryCode || null,
    ipv6: redactIp(ipv6),
    ipv6Network: ipv6Info?.status === 'success' ? networkLabel(ipv6Info) : null,
    ipv6Country: ipv6Info?.countryCode || null,
    signals: {
      proxy: data.proxy === true,
      hosting: data.hosting === true,
      mobile: data.mobile === true,
      timezoneMismatch: !!(data.timezone && Intl.DateTimeFormat().resolvedOptions().timeZone !== data.timezone),
      webrtcDifferentPublicIp: (webrtc.pub || []).some(ip => ip !== data.query),
    },
    webrtc: {
      publicCount: webrtc.pub?.length || 0,
      privateCount: webrtc.lan?.length || 0,
      relayCount: webrtc.relay?.length || 0,
      mdnsMaskedCount: webrtc.mdns || 0,
      candidateTypes: [...new Set((webrtc.candidates || []).map(c => c.type))],
    },
    cloudflare: cfTrace ? {
      colo: cfTrace.colo || null,
      loc: cfTrace.loc || null,
      warp: cfTrace.warp || null,
      gateway: cfTrace.gateway || null,
      http: cfTrace.http || null,
    } : null,
    headersObserved: Object.keys(headers || {}).sort(),
    note: 'Redacted report: exact IP addresses and full header values are intentionally omitted.',
  };
}

/* ── load ── */
async function load() {
  const btn = document.getElementById('refresh-btn');
  btn.textContent = '↺';
  btn.classList.add('spinning');

  // reset skeletons
  document.getElementById('ip-display').innerHTML = '<span class="skel skel-ip"></span>';
  document.getElementById('copy-hint').textContent = '';
  document.getElementById('hero-sub').innerHTML = '<span class="skel skel-text"></span>';
  document.getElementById('status-row').innerHTML = '';
  document.getElementById('hero-ip-grid').innerHTML = '';
  ['card-location','card-network','card-privacy','card-browser','card-ipv6'].forEach(id => {
    document.getElementById(id).innerHTML = '<div class="skel skel-block"></div>';
  });
  document.getElementById('card-fingerprint').innerHTML = '<div class="skel skel-block"></div>';
  document.getElementById('card-headers').innerHTML = '<div class="skel skel-block"></div>';
  document.getElementById('webrtc-result').innerHTML = '<span class="skel skel-text"></span>';

  const [data, webrtc, ipv6, cfTrace, headers] = await Promise.all([
    fetch('/api/info').then(r => r.json()).catch(() => ({})),
    getWebRTCIPs(),
    getIPv6(),
    getCFTrace(),
    fetch('/api/headers').then(r => r.json()).catch(() => ({})),
  ]);
  const ipv6Info = ipv6
    ? await fetch(`/api/info?ip=${encodeURIComponent(ipv6)}`).then(r => r.json()).catch(() => null)
    : null;

  const isVPN = data.proxy === true ||
    ['vpn','proxy','anonymi','virtual private'].some(k =>
      ((data.isp||'') + ' ' + (data.org||'')).toLowerCase().includes(k));

  latestReport = buildReport(data, webrtc, ipv6, ipv6Info, cfTrace, headers);

  renderHero(data, isVPN, ipv6, ipv6Info);
  renderLocation(data);
  renderNetwork(data);
  renderPrivacy(data, webrtc);
  renderBrowser(data.timezone);
  renderIPv6(ipv6, ipv6Info, cfTrace, data);
  renderFingerprint(); // async internally, no await needed
  renderHeaders(headers);
  renderWebRTC(webrtc, data.query);

  btn.classList.remove('spinning');
  btn.textContent = '↺';
}

/* ── theme ── */
const SUN = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
const MOON = `<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('theme-btn');
  if (btn) btn.innerHTML = theme === 'dark' ? SUN : MOON;
}
function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('ipspeil-theme', next);
  applyTheme(next);
}
function initTheme() {
  const saved = localStorage.getItem('ipspeil-theme');
  const theme = saved || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  applyTheme(theme);
}

function copyIP() {
  if (!currentIP) return;
  navigator.clipboard.writeText(currentIP).then(() => {
    const hint = document.getElementById('copy-hint');
    hint.textContent = 'copied ✓';
    hint.classList.add('copy-success');
    setTimeout(() => {
      hint.textContent = 'click to copy';
      hint.classList.remove('copy-success');
    }, 1800);
  });
}

function copyReport() {
  const btn = document.getElementById('report-btn');
  if (!latestReport || !navigator.clipboard) return;
  navigator.clipboard.writeText(JSON.stringify(latestReport, null, 2)).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = original; }, 1600);
  });
}

initTheme();
document.getElementById('theme-btn')?.addEventListener('click', toggleTheme);
document.getElementById('refresh-btn')?.addEventListener('click', load);
document.getElementById('report-btn')?.addEventListener('click', copyReport);
document.getElementById('ip-wrapper')?.addEventListener('click', copyIP);
load();
