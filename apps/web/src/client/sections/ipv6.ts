import { byId, kv, note } from "../lib/dom.ts";
import { esc, flag, formatPlace, networkLabel } from "../lib/format.ts";
import type { CFTrace, Exits, IpInfo } from "../types.ts";

function cloudflareTrace(cfTrace: CFTrace | null): string {
  let html = `<div class="divider"></div><div class="sub-l">Cloudflare trace</div>`;
  if (!cfTrace) {
    return (
      html +
      note("off", "Cloudflare trace unavailable", "Routing cross-check could not be reached.")
    );
  }
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
  if (cfTrace.http) html += kv("CF reports protocol", esc(cfTrace.http));
  return html;
}

export function renderIPv6(
  exits: Exits,
  ipv6Info: IpInfo | null,
  cfTrace: CFTrace | null,
  httpInfo: IpInfo,
) {
  const el = byId("body-ipv6");
  let html = "";

  if (exits.http) html += kv("HTTP exit IP", `<span class="m">${esc(exits.http)}</span>`);
  if (exits.v4) html += kv("IPv4 exit", `<span class="m">${esc(exits.v4)}</span>`);
  if (exits.v4 && exits.http && exits.v4 !== exits.http) {
    html += note(
      "warn",
      "IPv4 exit differs from HTTP IP",
      "Your forced-IPv4 exit is a different address than the server saw — split routing or a proxy.",
    );
  }

  if (exits.v6) {
    const countryDiffers =
      ipv6Info?.countryCode &&
      httpInfo?.countryCode &&
      ipv6Info.countryCode !== httpInfo.countryCode;
    const asDiffers = ipv6Info?.as && httpInfo?.as && ipv6Info.as !== httpInfo.as;
    const mismatch = countryDiffers || asDiffers;
    html += note(
      mismatch ? "warn" : "off",
      "IPv6 reachable",
      mismatch
        ? "IPv4 and IPv6 exit through different networks or countries — a possible VPN leak."
        : "IPv6 is reachable. Normal unless it bypasses the network you expected.",
    );
    html += kv("IPv6 exit", `<span class="m">${esc(exits.v6)}</span>`);
    if (ipv6Info?.status === "success") {
      html += kv("IPv6 location", esc(formatPlace(ipv6Info)));
      html += kv("IPv6 network", esc(networkLabel(ipv6Info)));
    }
    if (httpInfo?.query) html += kv("IPv4 network", esc(networkLabel(httpInfo)));
  } else {
    html += note(
      "off",
      "No IPv6 detected",
      "This browser did not reach the IPv6-only endpoint — IPv4-only, or IPv6 disabled/blocked.",
    );
  }

  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;
  if (nav?.nextHopProtocol) html += kv("This page negotiated", esc(nav.nextHopProtocol));

  html += cloudflareTrace(cfTrace);
  el.innerHTML = html;
}
