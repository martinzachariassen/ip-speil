import { InfoTip } from "@martinzachariassen/design";
import type { ReactNode } from "react";

// A small glossary of the jargon this app surfaces. Each entry pairs a heading
// (`title`) with a plain-language "what / why" (`body`). The <Tip> component
// below turns a key into an inline info button + popover, so an explanation sits
// right next to the term it clarifies — no need to leave the page to understand
// what "ASN" or "WebRTC leak" means.
interface GlossaryEntry {
  title: string;
  body: ReactNode;
}

export const GLOSSARY = {
  publicIp: {
    title: "Public IP address",
    body: "The address your whole network shows to the internet. Every site you open sees it — it's how replies find their way back to you, and it roughly places you on the map.",
  },
  asn: {
    title: "ASN — Autonomous System Number",
    body: "The ID of the network carrying your traffic — usually your ISP or a hosting company. It tells any site which provider you're on.",
  },
  reverseDns: {
    title: "Reverse DNS (PTR)",
    body: "The hostname your IP maps back to. It often gives away your ISP, your region, or that you're on a datacenter or VPN connection.",
  },
  geoAgreement: {
    title: "Geo agreement",
    body: "We check your location against several independent databases. When they agree, the location is more trustworthy; disagreement can hint at a VPN or stale data.",
  },
  geoCrossCheck: {
    title: "Geo cross-check",
    body: "How many geolocation sources agree on your country. More agreement means the estimate is more reliable.",
  },
  geoDataset: {
    title: "Geo dataset",
    body: "The IP-to-location and IP-to-network databases we resolve on our own server, so your IP is never handed to a third-party geolocation service.",
  },
  vpnProxyTor: {
    title: "VPN / proxy / Tor",
    body: "Tools that route your traffic through another server to hide your real IP. Sites can often spot the datacenter networks they run on.",
  },
  datacenterIp: {
    title: "Datacenter / cloud IP",
    body: "An address owned by a hosting company rather than a home ISP. It's a strong hint you're behind a VPN, proxy, or server instead of an ordinary connection.",
  },
  reputationDb: {
    title: "Reputation databases",
    body: "Public blocklists that flag IPs seen sending spam, abuse, or attacks. A listing can earn you extra CAPTCHAs or outright blocks — even if it wasn't you.",
  },
  webrtcLeak: {
    title: "WebRTC leak",
    body: "WebRTC (the tech behind in-browser calls) can reveal your real IP even behind a VPN, because it asks your device directly for its network addresses.",
  },
  iceCandidate: {
    title: "ICE candidates",
    body: "The list of network addresses WebRTC gathers to set up a peer-to-peer connection — which can include your real public and local IPs.",
  },
  mdns: {
    title: "mDNS masking",
    body: "A privacy feature where the browser swaps your local IP for a random “.local” name in WebRTC, hiding your network layout from sites.",
  },
  turn: {
    title: "Relay candidate (TURN)",
    body: "A relay server that carries WebRTC traffic when a direct link isn't possible. Sites see the relay's address, not yours.",
  },
  lanIp: {
    title: "Local / LAN IP",
    body: "Your address inside your home or office network (e.g. 192.168.x.x). It can't be reached from the internet, but it can reveal how your network is set up.",
  },
  dnsLeak: {
    title: "DNS leak",
    body: "When your device looks up website names through a resolver outside your VPN, exposing which sites you visit — and often your real region.",
  },
  doh: {
    title: "DNS-over-HTTPS (DoH)",
    body: "Encrypts your DNS lookups so your network can't easily see or tamper with the sites you request. “Blocked” means something on the path is stopping it.",
  },
  dnssec: {
    title: "DNSSEC",
    body: "Cryptographic signatures that let your resolver verify DNS answers weren't forged, protecting you from certain domain-spoofing attacks.",
  },
  resolver: {
    title: "DNS resolver",
    body: "The service that turns website names into IP addresses for you — usually run by your ISP or a provider like Cloudflare or Google.",
  },
  fingerprint: {
    title: "Browser fingerprint",
    body: "The combination of your browser and device traits — screen, fonts, GPU, and more — that can single you out and track you without any cookies.",
  },
  entropy: {
    title: "Entropy (bits)",
    body: "A measure of how rare your fingerprint is. More bits means more unique, and easier to identify — around 33 bits is enough to pick one person out of everyone on Earth.",
  },
  canvasFp: {
    title: "Canvas fingerprint",
    body: "Sites draw hidden graphics and hash the result. Tiny differences in your GPU and drivers make the output fairly unique to your device.",
  },
  audioFp: {
    title: "Audio fingerprint",
    body: "Like the canvas trick, but using your device's audio stack — small processing differences produce a stable identifier.",
  },
  gpuRenderer: {
    title: "GPU renderer (WebGL)",
    body: "The name of your graphics chip, exposed through WebGL. It's a strong signal for telling your device apart from others.",
  },
  userAgent: {
    title: "User agent",
    body: "A line your browser sends naming its version and your operating system. It's a basic tracking signal and part of your fingerprint.",
  },
  doNotTrack: {
    title: "Do Not Track (DNT)",
    body: "An older browser flag asking sites not to track you. It's advisory only — almost no site honors it anymore.",
  },
  gpc: {
    title: "Global Privacy Control (GPC)",
    body: "A newer signal that legally asks sites not to sell or share your data under laws like California's CCPA. Some sites are required to honor it.",
  },
  clientHints: {
    title: "Client Hints",
    body: "Small headers your browser can send with device details (platform, model…) when a site opts in via the Accept-CH header — a quieter, modern alternative to the user agent.",
  },
  ipv6: {
    title: "IPv6",
    body: "The newer internet addressing scheme. If IPv6 is on but your VPN only covers IPv4, your real IPv6 address can leak out.",
  },
  splitRouting: {
    title: "Split routing",
    body: "When your IPv4 and IPv6 (or proxied vs. direct) traffic leave through different paths — a common VPN gap that can expose your real IP.",
  },
  exitIp: {
    title: "Exit IP",
    body: "The address the internet actually sees your requests coming from — which may differ from your device's IP if a VPN or proxy is in the way.",
  },
  rpki: {
    title: "RPKI",
    body: "A system that cryptographically checks whether a network is allowed to announce your IP range, guarding against route hijacks. “Valid” is the healthy state.",
  },
  roa: {
    title: "ROA — Route Origin Authorisation",
    body: "A signed record stating which network (ASN) may announce a given IP range. RPKI uses these to validate that traffic is being routed legitimately.",
  },
  bgpPrefix: {
    title: "Announced prefix (BGP)",
    body: "The block of IP addresses your provider advertises to the internet's routers. Your address lives somewhere inside it.",
  },
  originAsn: {
    title: "Origin ASN",
    body: "The network that originates the route for your IP range in the global routing table — the “home” network of your address.",
  },
  abuseContact: {
    title: "Abuse contact",
    body: "The address a network publishes for reporting misuse from its IPs. It's public information in the routing registry.",
  },
} satisfies Record<string, GlossaryEntry>;

export type GlossaryKey = keyof typeof GLOSSARY;

/**
 * An inline info button that explains a glossary term in a small popover.
 * Drop it next to any label: `<Tip k="asn" />`.
 */
export function Tip({ k, className }: { k: GlossaryKey; className?: string }) {
  const entry = GLOSSARY[k];
  return (
    <InfoTip
      label={`What is ${entry.title}?`}
      title={entry.title}
      className={className}
      contentClassName="font-grotesk"
    >
      {entry.body}
    </InfoTip>
  );
}
