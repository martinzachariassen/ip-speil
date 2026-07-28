import { flag, formatPlace, networkLabel } from "../../lib/format.ts";
import type { CFTrace, Exits, IpInfo } from "../../types.ts";
import { Divider, KV, Mono, Note, SubLabel } from "../primitives.tsx";

function CloudflareTrace({ cfTrace }: { cfTrace: CFTrace | null }) {
  if (!cfTrace) {
    return (
      <>
        <Divider />
        <SubLabel tip="cloudflareTrace">Connection security &amp; Cloudflare trace</SubLabel>
        <Note
          severity="off"
          title="Cloudflare trace unavailable"
          desc="Routing cross-check could not be reached."
        />
      </>
    );
  }

  const warp = cfTrace.warp === "on";
  const gateway = cfTrace.gateway === "on";
  const ech = cfTrace.sni === "encrypted";

  return (
    <>
      <Divider />
      <SubLabel>Connection security &amp; Cloudflare trace</SubLabel>
      <Note
        severity={warp || gateway ? "ok" : "off"}
        tip="warp"
        title={
          warp
            ? "Cloudflare WARP active"
            : gateway
              ? "Cloudflare Gateway active"
              : "Cloudflare WARP not detected"
        }
        desc={warp ? "Your traffic is routed through Cloudflare WARP VPN." : ""}
      />
      {cfTrace.sni ? (
        <Note
          severity={ech ? "ok" : "warn"}
          tip={ech ? "ech" : "sni"}
          title={ech ? "Encrypted Client Hello (ECH) in use" : "SNI sent in the clear"}
          desc={
            ech
              ? "The site name you requested was encrypted in the TLS handshake — on-path observers can't see which host you visited."
              : "The hostname you requested is visible to anyone on the network path, in the TLS ClientHello. ECH would hide it."
          }
        />
      ) : null}
      {cfTrace.tls ? (
        <KV k="TLS version" tip="tls">
          {cfTrace.tls}
        </KV>
      ) : null}
      {cfTrace.http ? <KV k="HTTP version">{cfTrace.http}</KV> : null}
      {cfTrace.kex ? (
        <KV k="Key exchange" tip="keyExchange">
          {cfTrace.kex}
        </KV>
      ) : null}
      {cfTrace.colo ? <KV k="Nearest CF datacenter">{cfTrace.colo}</KV> : null}
      {cfTrace.loc ? (
        <KV k="CF sees country">
          {flag(cfTrace.loc)} {cfTrace.loc}
        </KV>
      ) : null}
    </>
  );
}

export function IPv6({
  exits,
  ipv6Info,
  cfTrace,
  httpInfo,
}: {
  exits: Exits;
  ipv6Info: IpInfo | null;
  cfTrace: CFTrace | null;
  httpInfo: IpInfo;
}) {
  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;

  const countryDiffers =
    ipv6Info?.countryCode &&
    httpInfo?.countryCode &&
    ipv6Info.countryCode !== httpInfo.countryCode;
  const asDiffers = ipv6Info?.as && httpInfo?.as && ipv6Info.as !== httpInfo.as;
  const mismatch = countryDiffers || asDiffers;

  return (
    <>
      {exits.http ? (
        <KV k="HTTP exit IP" tip="exitIp">
          <Mono>{exits.http}</Mono>
        </KV>
      ) : null}
      {exits.v4 ? (
        <KV k="IPv4 exit">
          <Mono>{exits.v4}</Mono>
        </KV>
      ) : null}
      {exits.v4 && exits.http && exits.v4 !== exits.http ? (
        <Note
          severity="warn"
          tip="splitRouting"
          title="IPv4 exit differs from HTTP IP"
          desc="Your forced-IPv4 exit is a different address than the server saw — split routing or a proxy."
        />
      ) : null}

      {exits.v6 ? (
        <>
          <Note
            severity={mismatch ? "warn" : "off"}
            title="IPv6 reachable"
            desc={
              mismatch
                ? "IPv4 and IPv6 exit through different networks or countries — a possible VPN leak."
                : "IPv6 is reachable. Normal unless it bypasses the network you expected."
            }
          />
          <KV k="IPv6 exit">
            <Mono>{exits.v6}</Mono>
          </KV>
          {ipv6Info?.status === "success" ? (
            <>
              <KV k="IPv6 location">{formatPlace(ipv6Info)}</KV>
              <KV k="IPv6 network">{networkLabel(ipv6Info)}</KV>
            </>
          ) : null}
          {httpInfo?.query ? <KV k="IPv4 network">{networkLabel(httpInfo)}</KV> : null}
        </>
      ) : (
        <Note
          severity="off"
          title="No IPv6 detected"
          desc="This browser did not reach the IPv6-only endpoint — IPv4-only, or IPv6 disabled/blocked."
        />
      )}

      {nav?.nextHopProtocol ? <KV k="This page negotiated">{nav.nextHopProtocol}</KV> : null}

      <CloudflareTrace cfTrace={cfTrace} />
    </>
  );
}
