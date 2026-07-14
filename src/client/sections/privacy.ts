import { byId, note } from "../lib/dom.ts";
import { isSuccessfulLookup } from "../lib/format.ts";
import { ispSuggestsHosting, ispSuggestsVpn, webrtcLeak } from "../lib/heuristics.ts";
import type { DnsLeakResult, IpInfo, WebRTCResult } from "../types.ts";

function dnsNote(dnsLeak: DnsLeakResult, doh: boolean | null, d: IpInfo): string {
  if (dnsLeak.available) {
    const foreign = dnsLeak.resolvers.filter(
      (r) => r.country && d.country && r.country !== d.country,
    );
    if (foreign.length) {
      const where = [...new Set(foreign.map((r) => r.country))].join(", ");
      return note(
        "warn",
        "Possible DNS leak",
        `${foreign.length} resolver(s) in ${where} differ from your IP's country (${d.country}).`,
      );
    }
    return note(
      "ok",
      "No DNS leak detected",
      dnsLeak.conclusion || `${dnsLeak.resolvers.length} resolver(s) in your IP's country.`,
    );
  }
  if (doh === true) {
    return note(
      "ok",
      "DNS-over-HTTPS reachable",
      "Cloudflare's DoH endpoint responds — no DPI middlebox is blocking it.",
    );
  }
  if (doh === false) {
    return note(
      "warn",
      "DNS-over-HTTPS unreachable",
      "A captive portal, VPN or corporate DPI may be intercepting DNS.",
    );
  }
  return note(
    "off",
    "DNS test unavailable",
    "The DNS-leak probe could not complete from this network.",
  );
}

export function renderPrivacy(
  d: IpInfo,
  webrtc: WebRTCResult,
  dnsLeak: DnsLeakResult,
  doh: boolean | null,
) {
  const el = byId("body-privacy");
  if (!isSuccessfulLookup(d)) {
    el.innerHTML = note(
      "off",
      "Privacy checks limited",
      "Proxy, hosting and mobile signals need a successful IP lookup.",
    );
    return;
  }

  const items: string[] = [];

  if (d.tor === true) {
    items.push(
      note(
        "bad",
        "Tor exit node",
        "A known Tor exit relay. Sites may apply extra friction or block requests.",
      ),
    );
  }

  if (d.proxy === true || d.vpn === true || ispSuggestsVpn(d)) {
    items.push(
      note(
        "bad",
        "VPN / proxy detected",
        d.vpn === true
          ? "This IP belongs to a known VPN service."
          : d.proxy === true
            ? "This IP is a known proxy or anonymizer."
            : "ISP name matches a known VPN provider.",
      ),
    );
  } else if (d.tor !== true) {
    items.push(note("ok", "No known VPN / proxy", "Not flagged as a proxy, VPN or anonymizer."));
  }

  const blocklists = d.blocklists?.length
    ? d.blocklists
    : d.abuser === true
      ? ["an abuse database"]
      : [];
  if (blocklists.length) {
    items.push(
      note(
        "warn",
        "Listed in reputation databases",
        `Flagged by ${blocklists.join(", ")} — sites may treat this address with extra caution.`,
      ),
    );
  }

  if (d.hosting === true || ispSuggestsHosting(d)) {
    items.push(
      note(
        "warn",
        "Datacenter / cloud IP",
        "Traffic routes through a commercial hosting network — common with VPNs.",
      ),
    );
  } else {
    items.push(
      note("ok", "Not flagged as hosting", "Not identified as a datacenter or cloud network."),
    );
  }

  if (webrtcLeak(webrtc, d.query)) {
    items.push(
      note(
        "warn",
        "WebRTC public IP differs",
        "WebRTC exposed a public IP that does not match the HTTP IP — a possible VPN or routing leak.",
      ),
    );
  } else if (webrtc.pub.length === 0) {
    items.push(
      note(
        "ok",
        "WebRTC blocked or no public leak",
        webrtc.mdns
          ? "Local candidates were masked with mDNS hostnames by the browser."
          : "No public IPs were exposed via WebRTC.",
      ),
    );
  } else {
    items.push(note("ok", "No WebRTC leak", "WebRTC IP matches your public IP."));
  }

  if (d.mobile) items.push(note("off", "Mobile / cellular network", ""));

  items.push(dnsNote(dnsLeak, doh, d));

  el.innerHTML = items.join("");
}
