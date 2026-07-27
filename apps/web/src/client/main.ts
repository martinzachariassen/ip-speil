import { fetchHeaders, fetchInfo } from "./api.ts";
import { diffReports } from "./lib/diff.ts";
import { byId } from "./lib/dom.ts";
import { estimateEntropy } from "./lib/heuristics.ts";
import {
  clearSnapshot,
  computeFingerprintId,
  decodeShare,
  encodeShare,
  loadSnapshot,
  type Snapshot,
  saveSnapshot,
} from "./lib/snapshot.ts";
import { getDnsLeak } from "./probes/dns-leak.ts";
import { collectFingerprint } from "./probes/fingerprint.ts";
import { getCFTrace, getDohReachable, getIPv4, getIPv6 } from "./probes/network.ts";
import { getWebRTCIPs } from "./probes/webrtc.ts";
import { buildReport } from "./report.ts";
import { renderBrowser } from "./sections/browser.ts";
import { renderDiff, renderShared } from "./sections/diff.ts";
import { renderExposure } from "./sections/exposure.ts";
import { renderFacts } from "./sections/facts.ts";
import { renderFingerprint } from "./sections/fingerprint.ts";
import { renderHeaders } from "./sections/headers.ts";
import { renderHero } from "./sections/hero.ts";
import { renderIPv6 } from "./sections/ipv6.ts";
import { renderPrivacy } from "./sections/privacy.ts";
import { renderWebRTC } from "./sections/webrtc.ts";
import { initTheme, toggleTheme } from "./theme.ts";
import type {
  CFTrace,
  DnsLeakResult,
  EntropyEstimate,
  Exits,
  FingerprintData,
  HeaderMap,
  IpInfo,
  WebRTCResult,
} from "./types.ts";

const SECTION_IDS = ["privacy", "browser", "ipv6", "fingerprint", "headers", "webrtc"];

// Everything a full render needs, grouped so load() collects once and paints.
interface Scan {
  data: IpInfo;
  webrtc: WebRTCResult;
  ipv6Info: IpInfo | null;
  cfTrace: CFTrace | null;
  headers: HeaderMap;
  doh: boolean | null;
  dnsLeak: DnsLeakResult;
  fp: FingerprintData;
  entropy: EntropyEstimate;
  exits: Exits;
}

let currentIP = "";
let currentV6 = "";
let latestReport: ReturnType<typeof buildReport> | null = null;
let latestFingerprintId = "";

// Show how the current scan differs from the saved snapshot (if any).
function refreshDiff() {
  const snap = loadSnapshot();
  if (!snap || !latestReport) {
    renderDiff(null);
    return;
  }
  const fingerprintChanged = snap.fingerprintId !== latestFingerprintId;
  renderDiff(diffReports(snap.report, latestReport, snap.savedAt, fingerprintChanged));
}

function showSkeletons() {
  byId("ip-display").innerHTML = '<span class="skel skel-ip"></span>';
  byId("copy-hint").textContent = "copy IP";
  byId("ip-btn").classList.remove("copied");
  byId("v6-row").hidden = true;
  byId("hero-sub").innerHTML = '<span class="skel skel-text"></span>';
  byId("verdict-dot").className = "dot off pulse";
  byId("verdict-title").innerHTML = '<span class="skel skel-text"></span>';
  byId("verdict-sub").textContent = "";
  byId("badge-fingerprint").hidden = true;
  byId("exposure-grid").innerHTML = '<span class="skel skel-block"></span>';
  byId("facts").innerHTML =
    '<div class="fact"><div class="fact-l">Loading</div><div class="fact-v"><span class="skel skel-text"></span></div></div>';
  for (const id of SECTION_IDS) {
    byId(`body-${id}`).innerHTML = '<span class="skel skel-block"></span>';
  }
}

// Paint every section from an already-collected scan. Pure DOM work, no network.
function renderAll(scan: Scan) {
  const { data, webrtc, ipv6Info, cfTrace, headers, doh, dnsLeak, fp, entropy, exits } = scan;

  renderExposure({ d: data, webrtc, dnsLeak, doh, entropy });
  renderHero(data, exits.v6);
  renderFacts(data, exits);
  renderPrivacy(data, webrtc, dnsLeak, doh);
  renderBrowser(data);
  renderIPv6(exits, ipv6Info, cfTrace, data);
  renderFingerprint(fp, entropy);
  renderHeaders(headers);
  renderWebRTC(webrtc, data.query);

  const coordEl = document.getElementById("ft-coord");
  if (coordEl) {
    coordEl.textContent =
      data.lat != null && data.lon != null ? `${data.lat.toFixed(2)}, ${data.lon.toFixed(2)}` : "";
  }

  refreshDiff();
}

async function load() {
  const ico = document.getElementById("refresh-ico");
  ico?.classList.add("spin");
  showSkeletons();

  const [data, webrtc, ipv4, ipv6, cfTrace, headers, doh, dnsLeak, fp] = await Promise.all([
    fetchInfo(),
    getWebRTCIPs(),
    getIPv4(),
    getIPv6(),
    getCFTrace(),
    fetchHeaders(),
    getDohReachable(),
    getDnsLeak(),
    collectFingerprint(),
  ]);
  const ipv6Info = ipv6 ? await fetchInfo(ipv6) : null;
  const exits: Exits = { http: data.query ?? null, v4: ipv4, v6: ipv6 };
  const entropy = estimateEntropy(fp);
  latestFingerprintId = await computeFingerprintId(fp);

  currentIP = data.query || "";
  currentV6 = ipv6 ?? "";
  latestReport = buildReport({
    data,
    webrtc,
    exits,
    ipv6Info,
    cfTrace,
    headers,
    dnsLeak,
    doh,
    entropy,
  });

  const scan: Scan = { data, webrtc, ipv6Info, cfTrace, headers, doh, dnsLeak, fp, entropy, exits };
  renderAll(scan);

  ico?.classList.remove("spin");
}

function copyIP() {
  if (!currentIP) return;
  navigator.clipboard.writeText(currentIP).then(() => {
    const btn = byId("ip-btn");
    const hint = byId("copy-hint");
    const family = currentIP.includes(":") ? "IPv6" : "IPv4";
    hint.textContent = "copied ✓";
    btn.classList.add("copied");
    setTimeout(() => {
      hint.textContent = `copy ${family}`;
      btn.classList.remove("copied");
    }, 1800);
  });
}

function copyV6() {
  if (!currentV6) return;
  navigator.clipboard.writeText(currentV6).then(() => {
    const btn = byId("v6-btn");
    btn.textContent = "copied ✓";
    setTimeout(() => {
      btn.textContent = "copy v6";
    }, 1800);
  });
}

function flash(btn: HTMLElement, text: string) {
  const original = btn.textContent;
  btn.textContent = text;
  setTimeout(() => {
    btn.textContent = original;
  }, 1600);
}

function copyReport() {
  const btn = byId("report-btn");
  if (!latestReport || !navigator.clipboard) return;
  navigator.clipboard.writeText(JSON.stringify(latestReport, null, 2)).then(() => {
    flash(btn, "Copied ✓");
  });
}

function takeSnapshot() {
  if (!latestReport) return;
  const snap: Snapshot = {
    savedAt: new Date().toISOString(),
    report: latestReport,
    fingerprintId: latestFingerprintId,
  };
  saveSnapshot(snap);
  refreshDiff();
  flash(byId("snapshot-btn"), "Saved ✓");
}

function clearSnapshotAndUI() {
  clearSnapshot();
  refreshDiff();
}

function shareLink() {
  const btn = byId("share-btn");
  if (!latestReport || !navigator.clipboard) return;
  const url = `${location.origin}${location.pathname}#r=${encodeShare(latestReport)}`;
  navigator.clipboard.writeText(url).then(() => {
    flash(btn, "Link copied ✓");
  });
}

// If the page was opened with a shared report in the URL fragment (#r=…),
// decode and show it read-only. The fragment never reaches the server.
function checkSharedLink() {
  if (location.hash.startsWith("#r=")) {
    renderShared(decodeShare(location.hash.slice(3)));
  } else {
    renderShared(null);
  }
}

initTheme();
document.getElementById("theme-btn")?.addEventListener("click", toggleTheme);
document.getElementById("refresh-btn")?.addEventListener("click", load);
document.getElementById("report-btn")?.addEventListener("click", copyReport);
document.getElementById("snapshot-btn")?.addEventListener("click", takeSnapshot);
document.getElementById("clear-snapshot-btn")?.addEventListener("click", clearSnapshotAndUI);
document.getElementById("share-btn")?.addEventListener("click", shareLink);
document.getElementById("ip-btn")?.addEventListener("click", copyIP);
document.getElementById("v6-btn")?.addEventListener("click", copyV6);
for (const head of document.querySelectorAll(".rev-head")) {
  head.addEventListener("click", () => head.closest(".rev")?.classList.toggle("open"));
}
checkSharedLink();
load();
