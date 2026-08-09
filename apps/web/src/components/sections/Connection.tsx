import { FindingList } from "@martinzachariassen/design";
import { flag, formatPlace, networkLabel } from "../../lib/format.ts";
import type { CFTrace, Exits, IpInfo } from "../../types.ts";
import { Absent, Finding, KV, KVList, Mono } from "../primitives.tsx";

/**
 * Where the traffic actually leaves from — the exits, and whether they agree.
 *
 * The readings that are only ever "yes, normal" live in the ledger; the
 * `FindingList` is reserved for the two ways this can genuinely go wrong (a
 * forced-IPv4 exit that isn't the address the server saw, and IPv4/IPv6 leaving
 * through different networks). A bordered note saying "IPv6 is reachable, which
 * is normal" is a sentence the reader has to process to learn nothing.
 */
export function Connection({
  exits,
  ipv6Info,
  httpInfo,
}: {
  exits: Exits;
  ipv6Info: IpInfo | null;
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
  const splitRouting = Boolean(exits.v4 && exits.http && exits.v4 !== exits.http);
  const v6Mismatch = Boolean(exits.v6 && (countryDiffers || asDiffers));

  return (
    <>
      {splitRouting || v6Mismatch ? (
        <FindingList className="mb-4">
          {splitRouting ? (
            <Finding
              severity="warn"
              tip="splitRouting"
              title="IPv4 exit differs from the address the server saw"
            >
              Your forced-IPv4 exit is a different address than this page was contacted from —
              split routing or a proxy.
            </Finding>
          ) : null}
          {v6Mismatch ? (
            <Finding severity="warn" title="IPv4 and IPv6 leave through different networks">
              One of the two bypasses whatever you expected to carry your traffic — a common way
              for a VPN to leak.
            </Finding>
          ) : null}
        </FindingList>
      ) : null}

      <KVList>
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
        {exits.v6 ? (
          <KV k="IPv6 exit">
            <Mono>{exits.v6}</Mono>
          </KV>
        ) : null}
        {exits.v6 && ipv6Info?.status === "success" ? (
          <>
            <KV k="IPv6 location">{formatPlace(ipv6Info)}</KV>
            <KV k="IPv6 network">{networkLabel(ipv6Info)}</KV>
          </>
        ) : null}
        {nav?.nextHopProtocol ? (
          <KV k="This page negotiated" mono>
            {nav.nextHopProtocol}
          </KV>
        ) : null}
      </KVList>
    </>
  );
}

/**
 * What the TLS handshake gave away, as Cloudflare's own trace reports it.
 *
 * This used to be a sub-heading buried at the bottom of the exits section, which
 * is why it read as an afterthought: it is a different subject — not where you
 * come from, but what an observer on the path can see — and it gets its own
 * heading now.
 */
export function ConnectionSecurity({ cfTrace }: { cfTrace: CFTrace | null }) {
  if (!cfTrace) {
    return <Absent>The connection cross-check couldn&rsquo;t be reached. Nothing to show.</Absent>;
  }

  const warp = cfTrace.warp === "on";
  const gateway = cfTrace.gateway === "on";
  const ech = cfTrace.sni === "encrypted";

  return (
    <>
      {cfTrace.sni || warp || gateway ? (
        <FindingList className="mb-4">
          {cfTrace.sni ? (
            <Finding
              severity={ech ? "ok" : "warn"}
              tip={ech ? "ech" : "sni"}
              title={ech ? "Encrypted Client Hello in use" : "SNI sent in the clear"}
            >
              {ech
                ? "The site name you asked for was encrypted in the TLS handshake — nobody on the path can see which host you visited."
                : "The hostname you asked for is visible to anyone on the network path, in the TLS ClientHello. ECH would hide it."}
            </Finding>
          ) : null}
          {warp || gateway ? (
            <Finding
              severity="ok"
              tip="warp"
              title={warp ? "Cloudflare WARP active" : "Cloudflare Gateway active"}
            >
              This traffic is being carried through Cloudflare&rsquo;s network.
            </Finding>
          ) : null}
        </FindingList>
      ) : null}

      <KVList>
        {cfTrace.tls ? (
          <KV k="TLS version" tip="tls" mono>
            {cfTrace.tls}
          </KV>
        ) : null}
        {cfTrace.http ? (
          <KV k="HTTP version" mono>
            {cfTrace.http}
          </KV>
        ) : null}
        {cfTrace.kex ? (
          <KV k="Key exchange" tip="keyExchange" mono>
            {cfTrace.kex}
          </KV>
        ) : null}
        {cfTrace.colo ? (
          <KV k="Nearest CF datacenter" mono>
            {cfTrace.colo}
          </KV>
        ) : null}
        {cfTrace.loc ? (
          <KV k="CF sees country">
            {flag(cfTrace.loc)} {cfTrace.loc}
          </KV>
        ) : null}
      </KVList>
    </>
  );
}
