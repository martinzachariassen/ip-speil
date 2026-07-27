import { byId, kv, note } from "../lib/dom.ts";
import { esc, isSuccessfulLookup } from "../lib/format.ts";
import type { IpInfo, RpkiInfo } from "../types.ts";

function rpkiNote(rpki: RpkiInfo): string {
  if (rpki.state === "valid") {
    return note(
      "ok",
      "RPKI valid",
      "The BGP route for your network is cryptographically authorised — a signed ROA matches the announcing ASN and prefix.",
    );
  }
  if (rpki.state === "invalid") {
    return note(
      "bad",
      "RPKI invalid",
      "The route announcement does not match any signed ROA. This can indicate a misconfiguration or a route hijack.",
    );
  }
  return note(
    "off",
    "RPKI unknown",
    "No ROA covers this prefix, so origin validation is inconclusive. This is common and not a problem in itself.",
  );
}

export function renderRouting(d: IpInfo) {
  const el = byId("body-routing");

  if (!isSuccessfulLookup(d)) {
    el.innerHTML = note(
      "off",
      "Routing context limited",
      "BGP prefix, origin ASN and RPKI status need a successful IP lookup.",
    );
    return;
  }

  const r = d.routing;
  if (!r || (!r.prefix && !r.originAsn && !r.rpki)) {
    el.innerHTML = note(
      "off",
      "Routing context unavailable",
      "The routing registry (RIPEstat) could not be reached for this network.",
    );
    return;
  }

  const items: string[] = [];
  if (r.rpki) items.push(rpkiNote(r.rpki));

  let html = items.join("");
  html += kv("Announced prefix", r.prefix ? `<span class="m">${esc(r.prefix)}</span>` : null);
  html += kv("Origin ASN", r.originAsn ? esc(r.originAsn) : null);
  if (r.rpki) html += kv("RPKI state", esc(r.rpki.state));

  const roas = r.rpki?.roas ?? [];
  if (roas.length) {
    html += `<div class="sub-l">${esc("Route Origin Authorisations")}</div>`;
    for (const roa of roas) {
      const detail = [roa.origin, roa.prefix, roa.maxLength != null ? `≤/${roa.maxLength}` : ""]
        .filter(Boolean)
        .join(" · ");
      html += kv(roa.validity ? roa.validity : "ROA", `<span class="m sm">${esc(detail)}</span>`);
    }
  }

  if (r.abuseContacts?.length) {
    html += kv("Abuse contact", `<span class="m sm">${esc(r.abuseContacts.join(", "))}</span>`);
  }

  if (r.queried) {
    html += note(
      "off",
      "Privacy note",
      `Only the network block ${r.queried} was sent to the routing registry — your exact address never left the server.`,
    );
  }

  el.innerHTML = html;
}
