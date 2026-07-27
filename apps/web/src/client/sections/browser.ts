import { byId, kv } from "../lib/dom.ts";
import { esc } from "../lib/format.ts";
import { languageGeoCheck, timezoneCheck } from "../lib/heuristics.ts";
import type { IpInfo } from "../types.ts";

export function renderBrowser(d: IpInfo) {
  const el = byId("body-browser");
  const tz = timezoneCheck(d);
  const tzMismatch = tz.nameMismatch || tz.offsetMismatch;
  const langGeo = languageGeoCheck(d.countryCode);
  const dnt =
    navigator.doNotTrack === "1"
      ? "Enabled"
      : navigator.doNotTrack === "0"
        ? "Disabled"
        : "Not set";
  const gpc =
    navigator.globalPrivacyControl === true
      ? "Enabled"
      : navigator.globalPrivacyControl === false
        ? "Disabled"
        : "Not set";

  let html = "";
  if (tzMismatch) {
    html += `<p class="body-intro">Timezone mismatch — browser is <b>${esc(tz.browserTz)}</b> but your IP resolves to <b>${esc(d.timezone || "unknown")}</b>. Possible timezone spoofing or VPN mismatch.</p>`;
  }
  if (langGeo.mismatch) {
    html += `<p class="body-intro">Browser locale region <b>${esc(langGeo.langRegion)}</b> differs from your IP country <b>${esc(d.countryCode)}</b> — common when travelling or using a VPN.</p>`;
  }
  html += kv(
    "Timezone",
    `${esc(tz.browserTz)}${tzMismatch ? ' <span class="warnmark">⚠</span>' : ""}`,
  );
  html += kv("Language", esc(navigator.language));
  html += kv("All languages", esc((navigator.languages || [navigator.language]).join(", ")));
  html += kv("Do Not Track", dnt);
  html += kv("Global Privacy Control", gpc);
  html += kv("Cookies", navigator.cookieEnabled ? "Enabled" : "Disabled");
  html += kv("User agent", `<span class="m">${esc(navigator.userAgent)}</span>`);
  el.innerHTML = html;
}
