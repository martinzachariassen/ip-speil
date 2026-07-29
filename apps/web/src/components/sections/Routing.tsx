import { isSuccessfulLookup } from "../../lib/format.ts";
import type { IpInfo, RpkiInfo } from "../../types.ts";
import { KV, KVList, Mono, MonoSm, Note, SubLabel } from "../primitives.tsx";

function RpkiNote({ rpki }: { rpki: RpkiInfo }) {
  if (rpki.state === "valid") {
    return (
      <Note
        severity="ok"
        tip="rpki"
        title="RPKI valid"
        desc="The BGP route for your network is cryptographically authorised — a signed ROA matches the announcing ASN and prefix."
      />
    );
  }
  if (rpki.state === "invalid") {
    return (
      <Note
        severity="bad"
        tip="rpki"
        title="RPKI invalid"
        desc="The route announcement does not match any signed ROA. This can indicate a misconfiguration or a route hijack."
      />
    );
  }
  return (
    <Note
      severity="off"
      tip="rpki"
      title="RPKI unknown"
      desc="No ROA covers this prefix, so origin validation is inconclusive. This is common and not a problem in itself."
    />
  );
}

export function Routing({ d }: { d: IpInfo }) {
  if (!isSuccessfulLookup(d)) {
    return (
      <Note
        severity="off"
        title="Routing context limited"
        desc="BGP prefix, origin ASN and RPKI status need a successful IP lookup."
      />
    );
  }

  const r = d.routing;
  if (!r || (!r.prefix && !r.originAsn && !r.rpki)) {
    return (
      <Note
        severity="off"
        title="Routing context unavailable"
        desc="The routing registry (RIPEstat) could not be reached for this network."
      />
    );
  }

  const roas = r.rpki?.roas ?? [];

  return (
    <>
      {r.rpki ? <RpkiNote rpki={r.rpki} /> : null}
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

      {r.queried ? (
        <Note
          severity="off"
          title="Privacy note"
          desc={`Only the network block ${r.queried} was sent to the routing registry — your exact address never left the server.`}
        />
      ) : null}
    </>
  );
}
