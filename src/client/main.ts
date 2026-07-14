// Entry point: orchestrates the scan, wires up interactions, owns UI state.
import { fetchHeaders, fetchInfo } from "./api.ts";
import { byId } from "./dom.ts";
import { ispSuggestsVpn } from "./format.ts";
import { getCFTrace, getDohReachable, getIPv6 } from "./network.ts";
import {
  renderBrowser,
  renderFacts,
  renderFingerprint,
  renderHeaders,
  renderHero,
  renderIPv6,
  renderPrivacy,
  renderWebRTC,
} from "./render.ts";
import { buildReport } from "./report.ts";
import { initTheme, toggleTheme } from "./theme.ts";
import { getWebRTCIPs } from "./webrtc.ts";

const SECTION_IDS = ["privacy", "browser", "ipv6", "fingerprint", "headers", "webrtc"];

let currentIP = "";
let latestReport: ReturnType<typeof buildReport> | null = null;

function showSkeletons() {
  byId("ip-display").innerHTML = '<span class="skel skel-ip"></span>';
  byId("copy-hint").textContent = "click to copy";
  byId("ip-btn").classList.remove("copied");
  byId("hero-sub").innerHTML = '<span class="skel skel-text"></span>';
  byId("hero-status").innerHTML = "";
  byId("facts").innerHTML =
    '<div class="fact"><div class="fact-l">Loading</div><div class="fact-v"><span class="skel skel-text"></span></div></div>';
  for (const id of SECTION_IDS) {
    byId(`body-${id}`).innerHTML = '<span class="skel skel-block"></span>';
  }
}

/** Run every check in parallel and render the results. */
async function load() {
  const ico = document.getElementById("refresh-ico");
  ico?.classList.add("spin");
  showSkeletons();

  const [data, webrtc, ipv6, cfTrace, headers, doh] = await Promise.all([
    fetchInfo(),
    getWebRTCIPs(),
    getIPv6(),
    getCFTrace(),
    fetchHeaders(),
    getDohReachable(),
  ]);
  const ipv6Info = ipv6 ? await fetchInfo(ipv6) : null;

  currentIP = data.query || "";
  latestReport = buildReport(data, webrtc, ipv6, ipv6Info, cfTrace, headers, doh);

  renderHero(
    data,
    data.proxy === true || data.vpn === true || data.tor === true || ispSuggestsVpn(data),
  );
  renderFacts(data, ipv6);
  renderPrivacy(data, webrtc, doh);
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
    const btn = byId("ip-btn");
    const hint = byId("copy-hint");
    hint.textContent = "copied ✓";
    btn.classList.add("copied");
    setTimeout(() => {
      hint.textContent = "click to copy";
      btn.classList.remove("copied");
    }, 1800);
  });
}

function copyReport() {
  const btn = byId("report-btn");
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
