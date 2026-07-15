import { byId } from "../lib/dom.ts";
import { esc, flag, isSuccessfulLookup } from "../lib/format.ts";
import type { IpInfo } from "../types.ts";

// Middle-truncate a long IPv6 so the rail chip stays one line; the full
// address is in the title attribute and is what the copy button copies.
function shortV6(ip: string): string {
  const parts = ip.split(":");
  return parts.length > 5 ? `${parts.slice(0, 4).join(":")}:…:${parts[parts.length - 1]}` : ip;
}

export function renderHero(d: IpInfo, v6: string | null) {
  const hasLookup = isSuccessfulLookup(d);
  // Zero-width space after each colon lets IPv6 wrap at hextet boundaries on
  // narrow viewports. Copy uses the raw IP from main.ts.
  const displayIp = hasLookup && d.query ? d.query.replace(/:/g, ":​") : "Unavailable";
  byId("ip-display").textContent = displayIp;
  const family = d.query?.includes(":") ? "IPv6" : "IPv4";
  byId("copy-hint").textContent = hasLookup ? `copy ${family}` : "try refresh";
  byId("ip-btn").classList.remove("copied");

  const v6Row = byId("v6-row");
  if (v6 && v6 !== d.query) {
    const chip = byId("v6-chip");
    chip.textContent = shortV6(v6);
    chip.title = v6;
    v6Row.hidden = false;
  } else {
    v6Row.hidden = true;
  }

  const f = flag(d.countryCode);
  const place = [d.city, d.country].filter(Boolean).join(", ");
  byId("hero-sub").innerHTML = hasLookup
    ? [d.isp && `<div>${esc(d.isp)}</div>`, place && `<div>${f ? `${f} ` : ""}${esc(place)}</div>`]
        .filter(Boolean)
        .join("")
    : "<div>IP lookup failed or returned no usable result</div>";
}
