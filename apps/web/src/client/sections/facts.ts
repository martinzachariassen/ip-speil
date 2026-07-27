import { byId, fact } from "../lib/dom.ts";
import { esc, flag, isSuccessfulLookup } from "../lib/format.ts";
import { timezoneCheck } from "../lib/heuristics.ts";
import type { Exits, IpInfo } from "../types.ts";

export function renderFacts(d: IpInfo, exits: Exits) {
  const el = byId("facts");
  const ipv6Fact = exits.v6
    ? `<span class="m sm">${esc(exits.v6)}</span>`
    : '<span class="muted">not detected</span>';

  if (!isSuccessfulLookup(d)) {
    el.innerHTML =
      fact("Status", '<span class="muted">IP lookup unavailable — try Refresh</span>') +
      fact("IPv6", ipv6Fact);
    return;
  }

  const tz = timezoneCheck(d);
  const tzWarn = tz.nameMismatch || tz.offsetMismatch;
  const place = [d.city, d.regionName, d.country].filter(Boolean).join(", ");
  const loc = ((f) => (f ? `${f} ${esc(place)}` : esc(place)))(flag(d.countryCode));

  let html = "";
  html += fact("Location", loc || '<span class="muted">unknown</span>');
  if (d.lat != null && d.lon != null) {
    html += fact(
      "Coordinates",
      `<span class="m sm">${d.lat.toFixed(3)}, ${d.lon.toFixed(3)}</span> <span class="muted">city-level estimate</span>`,
    );
  }
  html += fact("Network", esc(d.isp || d.org) || '<span class="muted">unknown</span>');
  if (d.as) {
    html += fact(
      "ASN",
      `<span class="m sm">${esc(d.as)}</span>${d.asname ? ` <span class="muted">${esc(d.asname)}</span>` : ""}`,
    );
  }
  html += fact(
    "Reverse DNS",
    d.reverse ? `<span class="m sm">${esc(d.reverse)}</span>` : '<span class="muted">none</span>',
  );
  if (d.geo && d.geo.total > 1) {
    html += fact("Geo agreement", `${d.geo.agree}/${d.geo.total} sources agree on country`);
  }
  html += fact(
    "Timezone",
    `${esc(d.timezone || tz.browserTz)}${tzWarn ? ` <span class="muted">browser: ${esc(tz.browserTz)} ⚠</span>` : ""}`,
  );
  html += fact("IPv6", ipv6Fact);
  el.innerHTML = html;
}
