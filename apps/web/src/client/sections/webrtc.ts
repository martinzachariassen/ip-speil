import { byId, note } from "../lib/dom.ts";
import { esc } from "../lib/format.ts";
import { isForeignPublicIp, webrtcLeak } from "../lib/heuristics.ts";
import type { WebRTCResult } from "../types.ts";

function publicTag(ip: string, httpIp: string | undefined): string {
  if (isForeignPublicIp(ip, httpIp)) return `<span class="tag leak">${esc(ip)} ← differs</span>`;
  if (ip === httpIp) return `<span class="tag">${esc(ip)} ← matches HTTP</span>`;
  return `<span class="tag">${esc(ip)}</span>`;
}

export function renderWebRTC(webrtc: WebRTCResult, httpIp: string | undefined) {
  const el = byId("body-webrtc");
  const { pub, lan, relay, mdns, candidates } = webrtc;

  if (pub.length === 0 && lan.length === 0 && relay.length === 0 && mdns === 0) {
    el.innerHTML = note(
      "off",
      "No IP candidates exposed",
      "WebRTC may be blocked or unavailable in this browser.",
    );
    return;
  }

  const leak = webrtcLeak(webrtc, httpIp);
  let html = leak
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
      .map((ip) => publicTag(ip, httpIp))
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
    html += `<p class="body-intro">If you expected all traffic to use one VPN exit, check your browser or VPN WebRTC leak protection.</p>`;
  }

  el.innerHTML = html;
}
