import { FindingList } from "@martinzachariassen/design";
import { isSuccessfulLookup } from "../../lib/format.ts";
import type { GlossaryKey } from "../../lib/glossary.tsx";
import {
  foreignResolvers,
  ispSuggestsHosting,
  ispSuggestsVpn,
  webrtcLeak,
} from "../../lib/heuristics.ts";
import type {
  DnsLeakResult,
  DnssecResult,
  EntropyEstimate,
  IpInfo,
  WebRTCResult,
} from "../../types.ts";
import { Absent, Finding as FindingRow, type Severity } from "../primitives.tsx";

interface Finding {
  severity: Severity;
  title: string;
  why?: string;
  tip?: GlossaryKey;
}

function collect({
  d,
  webrtc,
  dnsLeak,
  doh,
  dnssec,
  entropy,
}: {
  d: IpInfo;
  webrtc: WebRTCResult;
  dnsLeak: DnsLeakResult;
  doh: boolean | null;
  dnssec: DnssecResult;
  entropy: EntropyEstimate;
}): Finding[] {
  const findings: Finding[] = [];

  if (d.tor === true) {
    findings.push({
      severity: "bad",
      tip: "vpnProxyTor",
      title: "Tor exit node",
      why: "A known Tor exit relay. Sites may apply extra friction or block requests outright.",
    });
  }

  if (d.proxy === true || d.vpn === true || ispSuggestsVpn(d)) {
    findings.push({
      severity: "bad",
      tip: "vpnProxyTor",
      title: "VPN or proxy detected",
      why:
        d.vpn === true
          ? "This IP belongs to a known VPN service."
          : d.proxy === true
            ? "This IP is a known proxy or anonymizer."
            : "The ISP name matches a known VPN provider.",
    });
  } else if (d.tor !== true) {
    findings.push({
      severity: "ok",
      tip: "vpnProxyTor",
      title: "No known VPN or proxy",
      why: "Not flagged as a proxy, VPN or anonymizer.",
    });
  }

  const blocklists = d.blocklists?.length
    ? d.blocklists
    : d.abuser === true
      ? ["an abuse database"]
      : [];
  if (blocklists.length) {
    findings.push({
      severity: "warn",
      tip: "reputationDb",
      title: "Listed in reputation databases",
      why: `Flagged by ${blocklists.join(", ")} — sites may treat this address with extra caution.`,
    });
  }

  if (d.hosting === true || ispSuggestsHosting(d)) {
    findings.push({
      severity: "warn",
      tip: "datacenterIp",
      title: "Datacenter or cloud IP",
      why: "Traffic routes through a commercial hosting network — common with VPNs, and unusual for a home line.",
    });
  } else {
    findings.push({
      severity: "ok",
      tip: "datacenterIp",
      title: "Not flagged as hosting",
      why: "Not identified as a datacenter or cloud network.",
    });
  }

  if (webrtcLeak(webrtc, d.query)) {
    findings.push({
      severity: "warn",
      tip: "webrtcLeak",
      title: "WebRTC exposes a different public IP",
      why: "A site can read an address that doesn't match the one your requests come from — split routing or a proxy.",
    });
  } else if (webrtc.pub.length === 0) {
    findings.push({
      severity: "ok",
      tip: "webrtcLeak",
      title: "WebRTC blocked, or no public leak",
      why: webrtc.mdns
        ? "Local candidates were masked with mDNS hostnames by the browser."
        : "No public IPs were exposed via WebRTC.",
    });
  } else {
    findings.push({
      severity: "ok",
      tip: "webrtcLeak",
      title: "No WebRTC leak",
      why: "The address WebRTC exposes is the one your requests already come from.",
    });
  }

  if (d.mobile) {
    findings.push({
      severity: "off",
      title: "Mobile or cellular network",
      why: "Addresses on a carrier network are usually shared by many subscribers and move as you do.",
    });
  }

  findings.push(dnsFinding({ dnsLeak, doh, d }));
  findings.push(dnssecFinding(dnssec));

  const bits = entropy.bits;
  findings.push({
    severity: bits >= 26 ? "bad" : bits >= 18 ? "warn" : "ok",
    tip: "fingerprint",
    title:
      bits >= 26
        ? "Fingerprint is very distinctive"
        : bits >= 18
          ? "Fingerprint is fairly distinctive"
          : "Fingerprint is unremarkable",
    why: `Roughly ${bits} bits of identifying information — ${entropy.rarity.toLowerCase()} among the browsers this measures.`,
  });

  return findings;
}

function dnsFinding({
  dnsLeak,
  doh,
  d,
}: {
  dnsLeak: DnsLeakResult;
  doh: boolean | null;
  d: IpInfo;
}): Finding {
  const via = dnsLeak.source ? ` (via ${dnsLeak.source})` : "";
  if (dnsLeak.available) {
    const foreign = foreignResolvers(dnsLeak.resolvers, d.country);
    if (foreign.length) {
      const where = [...new Set(foreign.map((r) => r.country))].join(", ");
      return {
        severity: "warn",
        tip: "dnsLeak",
        title: "Possible DNS leak",
        why: `${foreign.length} resolver(s) in ${where} differ from your IP's country (${d.country ?? "unknown"})${via}.`,
      };
    }
    return {
      severity: "ok",
      tip: "dnsLeak",
      title: "No DNS leak",
      why:
        dnsLeak.conclusion ||
        `${dnsLeak.resolvers.length} resolver(s) answered, all in your IP's country${via}.`,
    };
  }
  if (doh === true) {
    return {
      severity: "ok",
      tip: "doh",
      title: "DNS-over-HTTPS reachable",
      why: "Cloudflare's DoH endpoint responds — no middlebox is blocking encrypted DNS.",
    };
  }
  if (doh === false) {
    return {
      severity: "warn",
      tip: "doh",
      title: "DNS-over-HTTPS unreachable",
      why: "A captive portal, VPN or corporate DPI may be intercepting DNS.",
    };
  }
  return {
    severity: "off",
    title: "DNS-leak test unavailable",
    why: "The dedicated provider couldn't be reached, so this falls back to the DoH-reachability signal.",
  };
}

function dnssecFinding(dnssec: DnssecResult): Finding {
  if (dnssec.validates === true) {
    return {
      severity: "ok",
      tip: "dnssec",
      title: "DNSSEC validated",
      why: "Your resolver refused a domain with a deliberately broken signature, so forged answers for signed zones would be rejected.",
    };
  }
  if (dnssec.validates === false) {
    return {
      severity: "warn",
      tip: "dnssec",
      title: "No DNSSEC validation",
      why: "Your resolver still answered for a domain with a broken signature — signed zones aren't protected against spoofing.",
    };
  }
  return {
    severity: "off",
    tip: "dnssec",
    title: "DNSSEC test inconclusive",
    why: "The control domain couldn't be reached, so validation behaviour couldn't be determined.",
  };
}

/**
 * Every check that was run and how it came back — the section people scroll to
 * when the band up top says something is wrong.
 *
 * It's a `FindingList`, not a stack of `Callout`s: a callout is a block that
 * demands attention, which is right once and wrong nine times in a row. Each
 * finding names its own state in the title, and the dot only agrees with it.
 */
export function Privacy(props: {
  d: IpInfo;
  webrtc: WebRTCResult;
  dnsLeak: DnsLeakResult;
  doh: boolean | null;
  dnssec: DnssecResult;
  entropy: EntropyEstimate;
}) {
  if (!isSuccessfulLookup(props.d)) {
    return <Absent>Proxy, hosting and reputation checks all need a successful IP lookup.</Absent>;
  }

  return (
    <FindingList>
      {collect(props).map((f) => (
        <FindingRow key={f.title} severity={f.severity} title={f.title} tip={f.tip}>
          {f.why}
        </FindingRow>
      ))}
    </FindingList>
  );
}
