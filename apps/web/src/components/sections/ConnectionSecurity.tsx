import { FindingList } from "@martinzachariassen/design";
import { flag } from "../../lib/format.ts";
import type { CFTrace } from "../../types.ts";
import { Absent, Finding, KV, KVList } from "../primitives.tsx";

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
