// @ts-check
// All DOM rendering for the scan results. Each function writes into a section
// of the page; none fetch data or hold state.

import { fact, kv, note } from "./dom.js";
import { getCanvasHash, getColorGamut, getWebGL } from "./fingerprint.js";
import { esc, flag, formatPlace, isSuccessfulLookup, networkLabel } from "./format.js";

/**
 * Render the hero (IP, location summary, VPN/proxy status line).
 * Returns the resolved IP so the caller can own copy/report state.
 */
export function renderHero(d, isVPN) {
  const hasLookup = isSuccessfulLookup(d);
  document.getElementById("ip-display").textContent = hasLookup ? d.query : "Unavailable";
  document.getElementById("copy-hint").textContent = hasLookup ? "click to copy" : "try refresh";
  document.getElementById("ip-btn").classList.remove("copied");

  const f = flag(d.countryCode);
  document.getElementById("hero-sub").textContent = hasLookup
    ? [d.isp, [f, d.city, d.country].filter(Boolean).join(" ")].filter(Boolean).join(" · ")
    : "IP lookup failed or returned no usable result";

  const parts = [];
  if (!hasLookup) parts.push(["off", "Lookup unavailable"]);
  else if (isVPN) parts.push(["bad", "VPN / proxy signal"]);
  else if (d.hosting) parts.push(["warn", "Datacenter IP"]);
  else parts.push(["ok", "No VPN signal"]);
  if (hasLookup && d.mobile) parts.push(["off", "Mobile network"]);
  document.getElementById("hero-status").innerHTML = parts
    .map(([dot, text]) => `<span class="dot ${dot}"></span><span>${esc(text)}</span>`)
    .join("");

  return hasLookup ? d.query : "";
}

export function renderFacts(d, ipv6) {
  const el = document.getElementById("facts");
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (!isSuccessfulLookup(d)) {
    el.innerHTML =
      fact("Status", '<span class="muted">IP lookup unavailable — try Refresh</span>') +
      fact(
        "IPv6",
        ipv6 ? `<span class="m sm">${esc(ipv6)}</span>` : '<span class="muted">not detected</span>',
      );
    return;
  }

  const place = [d.city, d.regionName, d.country].filter(Boolean).join(", ");
  const loc = ((f) => (f ? `${f} ${esc(place)}` : esc(place)))(flag(d.countryCode));
  const tzMismatch = d.timezone && browserTz !== d.timezone;

  let html = "";
  html += fact("Location", loc || '<span class="muted">unknown</span>');
  if (d.lat != null && d.lon != null)
    html += fact(
      "Coordinates",
      `<span class="m sm">${d.lat.toFixed(3)}, ${d.lon.toFixed(3)}</span>`,
    );
  html += fact("Network", esc(d.isp || d.org) || '<span class="muted">unknown</span>');
  if (d.as)
    html += fact(
      "ASN",
      `<span class="m sm">${esc(d.as)}</span>${d.asname ? ` <span class="muted">${esc(d.asname)}</span>` : ""}`,
    );
  html += fact(
    "Reverse DNS",
    d.reverse ? `<span class="m sm">${esc(d.reverse)}</span>` : '<span class="muted">none</span>',
  );
  html += fact(
    "Timezone",
    `${esc(d.timezone || browserTz)}${tzMismatch ? ` <span class="muted">browser: ${esc(browserTz)} ⚠</span>` : ""}`,
  );
  html += fact(
    "IPv6",
    ipv6 ? `<span class="m sm">${esc(ipv6)}</span>` : '<span class="muted">not detected</span>',
  );
  el.innerHTML = html;
}

export function renderPrivacy(d, webrtc) {
  const el = document.getElementById("body-privacy");
  if (!isSuccessfulLookup(d)) {
    el.innerHTML = note(
      "off",
      "Privacy checks limited",
      "Proxy, hosting and mobile signals need a successful IP lookup.",
    );
    return;
  }

  const isProxy = d.proxy === true;
  const isHosting = d.hosting === true;
  const ispText = `${d.isp || ""} ${d.org || ""} ${d.asname || ""}`.toLowerCase();
  const ispSuggestsVPN = ["vpn", "proxy", "anonymi", "vps", "virtual private"].some((k) =>
    ispText.includes(k),
  );
  const ispSuggestsHosting = [
    "hosting",
    "cloud",
    "digitalocean",
    "linode",
    "vultr",
    "amazon",
    "google cloud",
    "azure",
    "hetzner",
    "ovh",
    "datacenter",
    "colocation",
    "serverius",
  ].some((k) => ispText.includes(k));
  const webrtcLeak = webrtc.pub.length > 0 && !webrtc.pub.includes(d.query);

  const items = [];
  if (isProxy || ispSuggestsVPN) {
    items.push(
      note(
        "bad",
        "VPN / proxy detected",
        isProxy
          ? "This IP is a known proxy or VPN exit node."
          : "ISP name matches a known VPN provider.",
      ),
    );
  } else {
    items.push(note("ok", "No known VPN / proxy", "Not flagged as a proxy, VPN or anonymizer."));
  }
  if (isHosting || ispSuggestsHosting) {
    items.push(
      note(
        "warn",
        "Datacenter / cloud IP",
        "Traffic routes through a commercial hosting network — common with VPNs.",
      ),
    );
  } else {
    items.push(
      note(
        "ok",
        "Not flagged as hosting",
        "Not identified as a datacenter or cloud network by the lookup source.",
      ),
    );
  }
  if (webrtcLeak) {
    items.push(
      note(
        "warn",
        "WebRTC public IP differs",
        "WebRTC exposed a public IP that does not match the HTTP IP. This can indicate a VPN or routing leak.",
      ),
    );
  } else if (webrtc.pub.length === 0) {
    items.push(
      note(
        "ok",
        "WebRTC blocked or no public leak",
        webrtc.mdns
          ? "Local candidates were masked with mDNS hostnames by the browser."
          : "No public IPs were exposed via WebRTC.",
      ),
    );
  } else {
    items.push(note("ok", "No WebRTC leak", "WebRTC IP matches your public IP."));
  }
  if (d.mobile) items.push(note("off", "Mobile / cellular network", ""));

  el.innerHTML = items.join("");
}

export function renderBrowser(ipTimezone) {
  const el = document.getElementById("body-browser");
  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const tzMatch = !ipTimezone || browserTz === ipTimezone;
  const dnt =
    navigator.doNotTrack === "1"
      ? "Enabled"
      : navigator.doNotTrack === "0"
        ? "Disabled"
        : "Not set";

  let html = "";
  if (!tzMatch) {
    html += `<p class="body-intro">Timezone mismatch — browser is set to <b>${esc(browserTz)}</b> but your IP resolves to <b>${esc(ipTimezone)}</b>. Possible timezone spoofing or VPN mismatch.</p>`;
  }
  html += kv("Timezone", `${esc(browserTz)}${!tzMatch ? ' <span class="warnmark">⚠</span>' : ""}`);
  html += kv("Language", esc(navigator.language));
  html += kv("All languages", esc((navigator.languages || [navigator.language]).join(", ")));
  html += kv("Do Not Track", dnt);
  html += kv("Cookies", navigator.cookieEnabled ? "Enabled" : "Disabled");
  html += kv("User agent", `<span class="m">${esc(navigator.userAgent)}</span>`);
  el.innerHTML = html;
}

export function renderIPv6(ipv6, ipv6Info, cfTrace, publicIPv4Info) {
  const el = document.getElementById("body-ipv6");
  let html = "";

  if (ipv6) {
    const countryDiffers =
      ipv6Info?.countryCode &&
      publicIPv4Info?.countryCode &&
      ipv6Info.countryCode !== publicIPv4Info.countryCode;
    const asDiffers = ipv6Info?.as && publicIPv4Info?.as && ipv6Info.as !== publicIPv4Info.as;
    const mismatch = countryDiffers || asDiffers;
    html += note(
      mismatch ? "warn" : "off",
      "IPv6 address detected",
      mismatch
        ? "IPv4 and IPv6 appear to exit through different networks or countries. That can be a VPN leak signal."
        : "IPv6 is reachable from this browser. That is normal unless it bypasses the network you expected.",
    );
    html += kv("IPv6 address", `<span class="m">${esc(ipv6)}</span>`);
    if (ipv6Info?.status === "success") {
      html += kv("IPv6 location", esc(formatPlace(ipv6Info)));
      html += kv("IPv6 network", esc(networkLabel(ipv6Info)));
    }
    if (publicIPv4Info?.query) html += kv("IPv4 network", esc(networkLabel(publicIPv4Info)));
  } else {
    html += note(
      "off",
      "No IPv6 detected",
      "This browser did not reach the IPv6-only test endpoint. Your connection may be IPv4-only, or IPv6 may be disabled or blocked.",
    );
  }

  html += `<div class="divider"></div><div class="sub-l">Cloudflare trace</div>`;
  if (cfTrace) {
    const warp = cfTrace.warp === "on";
    const gateway = cfTrace.gateway === "on";
    html += note(
      warp || gateway ? "ok" : "off",
      warp
        ? "Cloudflare WARP active"
        : gateway
          ? "Cloudflare Gateway active"
          : "Cloudflare WARP not detected",
      warp ? "Your traffic is routed through Cloudflare WARP VPN." : "",
    );
    if (cfTrace.colo) html += kv("Nearest CF datacenter", esc(cfTrace.colo));
    if (cfTrace.loc) html += kv("CF sees country", `${flag(cfTrace.loc)} ${esc(cfTrace.loc)}`);
    if (cfTrace.http) html += kv("HTTP protocol", esc(cfTrace.http));
  } else {
    html += note(
      "off",
      "Cloudflare trace unavailable",
      "Routing cross-check could not be reached from this browser.",
    );
  }

  el.innerHTML = html;
}

export async function renderFingerprint() {
  const el = document.getElementById("body-fingerprint");
  const [canvasHash, webgl] = await Promise.all([getCanvasHash(), Promise.resolve(getWebGL())]);

  const mem = navigator.deviceMemory ? `${navigator.deviceMemory} GB` : null;
  const cpu = navigator.hardwareConcurrency ? `${navigator.hardwareConcurrency} threads` : null;
  const screenInfo = `${screen.width}×${screen.height} @ ${screen.colorDepth}-bit`;
  const dpr = window.devicePixelRatio ? `${window.devicePixelRatio}×` : null;
  const touch = navigator.maxTouchPoints > 0 ? `Yes (${navigator.maxTouchPoints} points)` : "No";
  const gamut = getColorGamut();
  const hdr = matchMedia("(dynamic-range: high)").matches ? "Yes" : "No";

  let html = "";
  if (canvasHash) html += kv("Canvas fingerprint", `<span class="m">${esc(canvasHash)}…</span>`);
  if (webgl) {
    html += kv("GPU renderer", esc(webgl.renderer));
    html += kv("GPU vendor", esc(webgl.vendor));
  }
  html += kv("Screen", `<span class="m sm">${esc(screenInfo)}</span>`);
  if (dpr) html += kv("Device pixel ratio", dpr);
  if (cpu) html += kv("CPU threads", cpu);
  if (mem) html += kv("Device memory", mem);
  html += kv("Touch support", touch);
  html += kv("Color gamut", gamut);
  html += kv("HDR", hdr);
  html += kv("Platform", esc(navigator.platform || "Not exposed"));

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (conn) {
    html += `<div class="sub-l">Connection — also a tracking signal</div>`;
    if (conn.type) html += kv("Type", esc(conn.type));
    if (conn.effectiveType) html += kv("Effective type", esc(conn.effectiveType));
    if (conn.downlink != null) html += kv("Est. downlink", `${conn.downlink} Mbps`);
    if (conn.rtt != null) html += kv("RTT", `${conn.rtt} ms`);
    if (conn.saveData != null) html += kv("Data saver", conn.saveData ? "On" : "Off");
  }

  el.innerHTML = html;
}

export function renderHeaders(headers) {
  const el = document.getElementById("body-headers");
  const PRIORITY = [
    "user-agent",
    "accept-language",
    "sec-ch-ua",
    "sec-ch-ua-mobile",
    "sec-ch-ua-platform",
    "sec-fetch-site",
    "sec-fetch-mode",
    "dnt",
    "referer",
  ];
  const entries = Object.entries(headers);
  entries.sort(([a], [b]) => {
    const ai = PRIORITY.indexOf(a);
    const bi = PRIORITY.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const rows = entries
    .map(([k, v]) => kv(k, `<span class="m">${esc(Array.isArray(v) ? v.join(", ") : v)}</span>`))
    .join("");

  el.innerHTML =
    `<p class="body-intro">These headers were sent to this page. Other sites may receive a slightly different set depending on browser policy, permissions, and server opt-ins.</p>` +
    (rows ||
      note(
        "off",
        "Headers unavailable",
        "The headers endpoint did not return any visible headers.",
      ));
}

export function renderWebRTC(webrtc, publicIP) {
  const el = document.getElementById("body-webrtc");
  const { pub = [], lan = [], relay = [], mdns = 0, candidates = [] } = webrtc;
  const leak = pub.some((ip) => ip !== publicIP);

  let html = "";
  if (pub.length === 0 && lan.length === 0 && relay.length === 0 && mdns === 0) {
    html = note(
      "off",
      "No IP candidates exposed",
      "WebRTC may be blocked or unavailable in this browser.",
    );
  } else {
    html += leak
      ? note(
          "warn",
          "Different public IP exposed",
          "WebRTC revealed a public address that differs from the one seen by normal HTTP requests.",
        )
      : note(
          "ok",
          "No different public IP exposed",
          "WebRTC did not reveal a public IP different from your HTTP IP.",
        );

    if (pub.length > 0) {
      html += `<div class="sub-l">Public IPs</div><div class="tags">${pub
        .map(
          (ip) =>
            `<span class="tag ${ip !== publicIP ? "leak" : ""}">${esc(ip)}${ip !== publicIP ? " ← differs" : " ← matches HTTP"}</span>`,
        )
        .join("")}</div>`;
    }
    if (lan.length > 0) {
      html += `<div class="sub-l">Local / LAN IPs</div><div class="tags">${lan
        .map((ip) => `<span class="tag local">${esc(ip)}</span>`)
        .join("")}</div>`;
    }
    if (relay.length > 0) {
      html += `<div class="sub-l">Relay candidates</div><div class="tags">${relay
        .map((ip) => `<span class="tag">${esc(ip)}</span>`)
        .join("")}</div>`;
    }
    if (mdns > 0) {
      html += `<p class="body-intro">${mdns} local candidate${mdns === 1 ? " was" : "s were"} hidden behind browser mDNS privacy masking.</p>`;
    }
    if (candidates.length > 0) {
      html +=
        `<div class="sub-l">All candidates</div>` +
        candidates
          .map(
            (c) =>
              `<div class="cand"><span class="c-kind">${esc(c.type)}</span><span class="c-addr">${esc(c.address)}</span><span class="c-scope">${esc(c.scope)}</span></div>`,
          )
          .join("");
    }
    if (leak) {
      html += `<p class="body-intro">WebRTC exposed a public address different from normal HTTP requests. If you expected all traffic to use one VPN exit, check your browser or VPN WebRTC leak protection.</p>`;
    }
  }
  el.innerHTML = html;
}
