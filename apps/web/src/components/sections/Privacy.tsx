import { Fragment } from "react";
import { isSuccessfulLookup } from "../../lib/format.ts";
import {
  foreignResolvers,
  ispSuggestsHosting,
  ispSuggestsVpn,
  webrtcLeak,
} from "../../lib/heuristics.ts";
import type { DnsLeakResult, DnssecResult, IpInfo, WebRTCResult } from "../../types.ts";
import { Note } from "../primitives.tsx";

function DnssecNote({ dnssec }: { dnssec: DnssecResult }) {
  if (dnssec.validates === true) {
    return (
      <Note
        severity="ok"
        tip="dnssec"
        title="DNSSEC validated by your resolver"
        desc="Your resolver refused a domain with a deliberately broken DNSSEC signature — forged DNS answers for signed zones would be rejected."
      />
    );
  }
  if (dnssec.validates === false) {
    return (
      <Note
        severity="warn"
        tip="dnssec"
        title="No DNSSEC validation"
        desc="Your resolver still answered for a domain with a broken DNSSEC signature, so it does not validate — signed zones aren't protected against DNS spoofing."
      />
    );
  }
  return (
    <Note
      severity="off"
      tip="dnssec"
      title="DNSSEC test inconclusive"
      desc="The control domain could not be reached, so validation behaviour couldn't be determined."
    />
  );
}

function DnsNote({
  dnsLeak,
  doh,
  d,
}: {
  dnsLeak: DnsLeakResult;
  doh: boolean | null;
  d: IpInfo;
}) {
  const via = dnsLeak.source ? ` (via ${dnsLeak.source})` : "";
  if (dnsLeak.available) {
    const foreign = foreignResolvers(dnsLeak.resolvers, d.country);
    if (foreign.length) {
      const where = [...new Set(foreign.map((r) => r.country))].join(", ");
      return (
        <Note
          severity="warn"
          tip="dnsLeak"
          title="Possible DNS leak"
          desc={`${foreign.length} resolver(s) in ${where} differ from your IP's country (${d.country ?? ""})${via}.`}
        />
      );
    }
    return (
      <Note
        severity="ok"
        tip="dnsLeak"
        title="No DNS leak detected"
        desc={dnsLeak.conclusion || `${dnsLeak.resolvers.length} resolver(s) in your IP's country${via}.`}
      />
    );
  }
  if (doh === true) {
    return (
      <Note
        severity="ok"
        tip="doh"
        title="DNS-over-HTTPS reachable"
        desc="Cloudflare's DoH endpoint responds — no DPI middlebox is blocking it."
      />
    );
  }
  if (doh === false) {
    return (
      <Note
        severity="warn"
        tip="doh"
        title="DNS-over-HTTPS unreachable"
        desc="A captive portal, VPN or corporate DPI may be intercepting DNS."
      />
    );
  }
  return (
    <Note
      severity="off"
      title="DNS-leak test unavailable"
      desc="The dedicated DNS-leak provider could not be reached, so this falls back to the DoH-reachability signal above."
    />
  );
}

export function Privacy({
  d,
  webrtc,
  dnsLeak,
  doh,
  dnssec,
}: {
  d: IpInfo;
  webrtc: WebRTCResult;
  dnsLeak: DnsLeakResult;
  doh: boolean | null;
  dnssec: DnssecResult;
}) {
  if (!isSuccessfulLookup(d)) {
    return (
      <Note
        severity="off"
        title="Privacy checks limited"
        desc="Proxy, hosting and mobile signals need a successful IP lookup."
      />
    );
  }

  const notes: React.ReactNode[] = [];

  if (d.tor === true) {
    notes.push(
      <Note
        severity="bad"
        tip="vpnProxyTor"
        title="Tor exit node"
        desc="A known Tor exit relay. Sites may apply extra friction or block requests."
      />,
    );
  }

  if (d.proxy === true || d.vpn === true || ispSuggestsVpn(d)) {
    notes.push(
      <Note
        severity="bad"
        tip="vpnProxyTor"
        title="VPN / proxy detected"
        desc={
          d.vpn === true
            ? "This IP belongs to a known VPN service."
            : d.proxy === true
              ? "This IP is a known proxy or anonymizer."
              : "ISP name matches a known VPN provider."
        }
      />,
    );
  } else if (d.tor !== true) {
    notes.push(
      <Note
        severity="ok"
        tip="vpnProxyTor"
        title="No known VPN / proxy"
        desc="Not flagged as a proxy, VPN or anonymizer."
      />,
    );
  }

  const blocklists = d.blocklists?.length
    ? d.blocklists
    : d.abuser === true
      ? ["an abuse database"]
      : [];
  if (blocklists.length) {
    notes.push(
      <Note
        severity="warn"
        tip="reputationDb"
        title="Listed in reputation databases"
        desc={`Flagged by ${blocklists.join(", ")} — sites may treat this address with extra caution.`}
      />,
    );
  }

  if (d.hosting === true || ispSuggestsHosting(d)) {
    notes.push(
      <Note
        severity="warn"
        tip="datacenterIp"
        title="Datacenter / cloud IP"
        desc="Traffic routes through a commercial hosting network — common with VPNs."
      />,
    );
  } else {
    notes.push(
      <Note
        severity="ok"
        tip="datacenterIp"
        title="Not flagged as hosting"
        desc="Not identified as a datacenter or cloud network."
      />,
    );
  }

  if (webrtcLeak(webrtc, d.query)) {
    notes.push(
      <Note
        severity="warn"
        tip="webrtcLeak"
        title="WebRTC public IP differs"
        desc="WebRTC exposed a public IP that does not match the HTTP IP — a possible VPN or routing leak."
      />,
    );
  } else if (webrtc.pub.length === 0) {
    notes.push(
      <Note
        severity="ok"
        tip="webrtcLeak"
        title="WebRTC blocked or no public leak"
        desc={
          webrtc.mdns
            ? "Local candidates were masked with mDNS hostnames by the browser."
            : "No public IPs were exposed via WebRTC."
        }
      />,
    );
  } else {
    notes.push(
      <Note
        severity="ok"
        tip="webrtcLeak"
        title="No WebRTC leak"
        desc="WebRTC IP matches your public IP."
      />,
    );
  }

  if (d.mobile) notes.push(<Note severity="off" title="Mobile / cellular network" />);

  notes.push(<DnsNote dnsLeak={dnsLeak} doh={doh} d={d} />);
  notes.push(<DnssecNote dnssec={dnssec} />);

  return (
    <>
      {notes.map((node, i) => (
        // Order is stable within a scan; index keys are fine here.
        // biome-ignore lint/suspicious/noArrayIndexKey: static, non-reordered list
        <Fragment key={i}>{node}</Fragment>
      ))}
    </>
  );
}
