import { FindingList } from "@martinzachariassen/design";
import { isSuccessfulLookup } from "../../lib/format.ts";
import type { IpInfo, RpkiInfo } from "../../types.ts";
import { Absent, Finding, Footnote, KV, KVList, Mono, MonoSm, SubLabel } from "../primitives.tsx";

function RpkiFinding({ rpki }: { rpki: RpkiInfo }) {
  if (rpki.state === "valid") {
    return (
      <Finding severity="ok" tip="rpki" title="RPKI valid">
        The BGP route for your network is cryptographically authorised — a signed ROA matches the
        announcing ASN and prefix.
      </Finding>
    );
  }
  if (rpki.state === "invalid") {
    return (
      <Finding severity="bad" tip="rpki" title="RPKI invalid">
        The route announcement does not match any signed ROA. This can indicate a misconfiguration
        or a route hijack.
      </Finding>
    );
  }
  return (
    <Finding severity="off" tip="rpki" title="RPKI unknown">
      No ROA covers this prefix, so origin validation is inconclusive. This is common and not a
      problem in itself.
    </Finding>
  );
}

export function Routing({ d }: { d: IpInfo }) {
  // A whole section with nothing in it is one muted line, not a bordered note
  // saying so at the same weight as a real finding.
  if (!isSuccessfulLookup(d)) {
    return <Absent>BGP prefix, origin ASN and RPKI status all need a successful IP lookup.</Absent>;
  }

  const r = d.routing;
  if (!r || (!r.prefix && !r.originAsn && !r.rpki)) {
    return (
      <Absent>
        The routing registry (RIPEstat) didn&rsquo;t answer for this network. Nothing to show.
      </Absent>
    );
  }

  const roas = r.rpki?.roas ?? [];

  return (
    <>
      {r.rpki ? (
        <FindingList className="mb-4">
          <RpkiFinding rpki={r.rpki} />
        </FindingList>
      ) : null}
      <KVList>
        {r.prefix ? (
          <KV k="Announced prefix" tip="bgpPrefix">
            <Mono>{r.prefix}</Mono>
          </KV>
        ) : null}
        {r.originAsn ? (
          <KV k="Origin ASN" tip="originAsn" mono>
            {r.originAsn}
          </KV>
        ) : null}
        {r.rpki ? (
          <KV k="RPKI state" tip="rpki">
            {r.rpki.state}
          </KV>
        ) : null}
      </KVList>

      {roas.length ? (
        <>
          <SubLabel tip="roa">Route Origin Authorisations</SubLabel>
          <KVList>
            {roas.map((roa, i) => {
              const detail = [
                roa.origin,
                roa.prefix,
                roa.maxLength != null ? `≤/${roa.maxLength}` : "",
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                // biome-ignore lint/suspicious/noArrayIndexKey: static, non-reordered list
                <KV key={i} k={roa.validity ? roa.validity : "ROA"}>
                  <MonoSm>{detail}</MonoSm>
                </KV>
              );
            })}
          </KVList>
        </>
      ) : null}

      {r.abuseContacts?.length ? (
        <KVList>
          <KV k="Abuse contact" tip="abuseContact">
            <MonoSm>{r.abuseContacts.join(", ")}</MonoSm>
          </KV>
        </KVList>
      ) : null}

      {/* A reassurance, not a reading: it costs a line, not a bordered note with
          a status dot claiming something was found. */}
      {r.queried ? (
        <Footnote>
          Only the network block {r.queried} was sent to the routing registry — your exact address
          never left the server.
        </Footnote>
      ) : null}
    </>
  );
}
