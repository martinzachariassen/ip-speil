// @ts-check
// Entry point: orchestrates the scan, wires up interactions, owns UI state.
import { fetchHeaders, fetchInfo } from "./api.js";
import { getCFTrace, getIPv6 } from "./network.js";
import {
  renderBrowser,
  renderFacts,
  renderFingerprint,
  renderHeaders,
  renderHero,
  renderIPv6,
  renderPrivacy,
  renderWebRTC,
} from "./render.js";
import { buildReport } from "./report.js";
import { initTheme, toggleTheme } from "./theme.js";
import { getWebRTCIPs } from "./webrtc.js";

const SECTION_IDS = ["privacy", "browser", "ipv6", "fingerprint", "headers", "webrtc"];

let currentIP = "";
let latestReport = null;

/** Heuristic VPN/proxy flag from ip-api data (proxy bit or ISP name match). */
function looksLikeVPN(data) {
  if (data.proxy === true) return true;
  const text = `${data.isp || ""} ${data.org || ""}`.toLowerCase();
  return ["vpn", "proxy", "anonymi", "virtual private"].some((k) => text.includes(k));
}

function showSkeletons() {
  document.getElementById("ip-display").innerHTML = '<span class="skel skel-ip"></span>';
  document.getElementById("copy-hint").textContent = "click to copy";
  document.getElementById("ip-btn").classList.remove("copied");
  document.getElementById("hero-sub").innerHTML = '<span class="skel skel-text"></span>';
  document.getElementById("hero-status").innerHTML = "";
  document.getElementById("facts").innerHTML =
    '<div class="fact"><div class="fact-l">Loading</div><div class="fact-v"><span class="skel skel-text"></span></div></div>';
  for (const id of SECTION_IDS) {
    document.getElementById(`body-${id}`).innerHTML = '<span class="skel skel-block"></span>';
  }
}

/** Run every check in parallel and render the results. */
async function load() {
  const ico = document.getElementById("refresh-ico");
  ico?.classList.add("spin");
  showSkeletons();

  const [data, webrtc, ipv6, cfTrace, headers] = await Promise.all([
    fetchInfo(),
    getWebRTCIPs(),
    getIPv6(),
    getCFTrace(),
    fetchHeaders(),
  ]);
  const ipv6Info = ipv6 ? await fetchInfo(ipv6) : null;

  currentIP = data.query || "";
  latestReport = buildReport(data, webrtc, ipv6, ipv6Info, cfTrace, headers);

  renderHero(data, looksLikeVPN(data));
  renderFacts(data, ipv6);
  renderPrivacy(data, webrtc);
  renderBrowser(data.timezone);
  renderIPv6(ipv6, ipv6Info, cfTrace, data);
  renderFingerprint(); // async internally; fire-and-forget
  renderHeaders(headers);
  renderWebRTC(webrtc, data.query);

  const coordEl = document.getElementById("ft-coord");
  if (coordEl) {
    coordEl.textContent =
      data.lat != null && data.lon != null ? `${data.lat.toFixed(2)}, ${data.lon.toFixed(2)}` : "";
  }

  ico?.classList.remove("spin");
}

function copyIP() {
  if (!currentIP) return;
  navigator.clipboard.writeText(currentIP).then(() => {
    const btn = document.getElementById("ip-btn");
    const hint = document.getElementById("copy-hint");
    hint.textContent = "copied ✓";
    btn.classList.add("copied");
    setTimeout(() => {
      hint.textContent = "click to copy";
      btn.classList.remove("copied");
    }, 1800);
  });
}

function copyReport() {
  const btn = document.getElementById("report-btn");
  if (!latestReport || !navigator.clipboard) return;
  navigator.clipboard.writeText(JSON.stringify(latestReport, null, 2)).then(() => {
    const original = btn.textContent;
    btn.textContent = "Copied ✓";
    setTimeout(() => {
      btn.textContent = original;
    }, 1600);
  });
}

initTheme();
document.getElementById("theme-btn")?.addEventListener("click", toggleTheme);
document.getElementById("refresh-btn")?.addEventListener("click", load);
document.getElementById("report-btn")?.addEventListener("click", copyReport);
document.getElementById("ip-btn")?.addEventListener("click", copyIP);
for (const head of document.querySelectorAll(".rev-head")) {
  head.addEventListener("click", () => head.closest(".rev")?.classList.toggle("open"));
}
load();
