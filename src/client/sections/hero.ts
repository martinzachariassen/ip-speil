import { byId } from "../lib/dom.ts";
import { esc, flag, isSuccessfulLookup } from "../lib/format.ts";
import type { IpInfo } from "../types.ts";

export function renderHero(d: IpInfo, isVpn: boolean) {
  const hasLookup = isSuccessfulLookup(d);
  // Zero-width space after each colon lets IPv6 wrap at hextet boundaries on
  // narrow viewports. Copy uses the raw IP from main.ts.
  const displayIp = hasLookup && d.query ? d.query.replace(/:/g, ":​") : "Unavailable";
  byId("ip-display").textContent = displayIp;
  byId("copy-hint").textContent = hasLookup ? "click to copy" : "try refresh";
  byId("ip-btn").classList.remove("copied");

  const f = flag(d.countryCode);
  byId("hero-sub").textContent = hasLookup
    ? [d.isp, [f, d.city, d.country].filter(Boolean).join(" ")].filter(Boolean).join(" · ")
    : "IP lookup failed or returned no usable result";

  const parts: [string, string][] = [];
  if (!hasLookup) parts.push(["off", "Lookup unavailable"]);
  else if (isVpn) parts.push(["bad", "VPN / proxy signal"]);
  else if (d.hosting) parts.push(["warn", "Datacenter IP"]);
  else parts.push(["ok", "No VPN signal"]);
  if (hasLookup && d.mobile) parts.push(["off", "Mobile network"]);

  byId("hero-status").innerHTML = parts
    .map(([dot, text]) => `<span class="dot ${dot}"></span><span>${esc(text)}</span>`)
    .join("");
}
