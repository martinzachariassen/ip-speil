import type { ReactNode } from "react";
import { flag, formatPlace, isSuccessfulLookup } from "../../lib/format.ts";
import type { GlossaryKey } from "../../lib/glossary.tsx";
import { timezoneCheck } from "../../lib/heuristics.ts";
import { Warning } from "../../lib/icons.tsx";
import type { Exits, IpInfo } from "../../types.ts";
import { Absent, KV, KVList, MonoSm, Muted } from "../primitives.tsx";

// One label/value row — the design system's grid <DataRow> (via <KV>), with a
// flex-wrap value cell so multi-part values (a mono figure + a muted aside) keep
// their spacing and wrap cleanly.
function Fact({ label, tip, children }: { label: string; tip?: GlossaryKey; children: ReactNode }) {
  return (
    <KV k={label} tip={tip}>
      {/* [&>*]:min-w-0 lets a long unbroken value (e.g. a full IPv6) break inside
          the flex row instead of forcing horizontal overflow on narrow screens. */}
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 break-words [&>*]:min-w-0">
        {children}
      </span>
    </KV>
  );
}

function LookupFailed() {
  return <Absent>IP lookup unavailable — try Refresh.</Absent>;
}

/**
 * Who is carrying your traffic — operator, ASN, reverse DNS, and whether the
 * address looks like a person's line or a datacenter's.
 */
export function NetworkFacts({ d, exits }: { d: IpInfo; exits: Exits }) {
  if (!isSuccessfulLookup(d)) return <LookupFailed />;

  return (
    <KVList>
      <Fact label="Network">{d.isp || d.org ? d.isp || d.org : <Muted>unknown</Muted>}</Fact>
      {d.as ? (
        <Fact label="ASN" tip="asn">
          <MonoSm>{d.as}</MonoSm>
          {d.asname ? <Muted>{d.asname}</Muted> : null}
        </Fact>
      ) : null}
      <Fact label="Reverse DNS" tip="reverseDns">
        {d.reverse ? <MonoSm>{d.reverse}</MonoSm> : <Muted>none</Muted>}
      </Fact>
      <Fact label="Type" tip="datacenterIp">
        {d.hosting ? "Datacenter or hosting" : d.mobile ? "Mobile / cellular" : "Consumer line"}
      </Fact>
      <Fact label="IPv6" tip="ipv6">
        {exits.v6 ? <MonoSm>{exits.v6}</MonoSm> : <Muted>not detected</Muted>}
      </Fact>
    </KVList>
  );
}

/**
 * Where the geo databases put you, and how much to trust that. The coordinates
 * are a city-level estimate, and they're shown as figures rather than plotted:
 * a map would mean a tile server, and a tile server would learn the very address
 * this page exists to tell you about.
 */
export function GeoFacts({ d }: { d: IpInfo }) {
  if (!isSuccessfulLookup(d)) return <LookupFailed />;

  const tz = timezoneCheck(d);
  const tzWarn = tz.nameMismatch || tz.offsetMismatch;
  const place = formatPlace(d);
  const f = flag(d.countryCode);

  return (
    <>
      <KVList>
        <Fact label="Location">
          {place ? (
            <span>
              {f ? `${f} ` : ""}
              {place}
            </span>
          ) : (
            <Muted>unknown</Muted>
          )}
        </Fact>
        {d.lat != null && d.lon != null ? (
          <Fact label="Coordinates">
            <MonoSm>
              {d.lat.toFixed(3)}, {d.lon.toFixed(3)}
            </MonoSm>{" "}
            <Muted>city-level estimate</Muted>
          </Fact>
        ) : null}
        <Fact label="Timezone">
          <span>{d.timezone || tz.browserTz}</span>
          {tzWarn ? (
            <Muted>
              browser: {tz.browserTz}{" "}
              <Warning className="inline-block align-[-2px] text-warning-deep" />
              <span className="sr-only">timezone mismatch</span>
            </Muted>
          ) : null}
        </Fact>
        {d.geo && d.geo.total > 1 ? (
          <Fact label="Geo agreement" tip="geoAgreement">
            {d.geo.agree}/{d.geo.total} sources agree on country
          </Fact>
        ) : null}
        {d.datasetDate ? (
          <Fact label="Geo dataset" tip="geoDataset">
            <MonoSm>{d.datasetDate.slice(0, 10)}</MonoSm>{" "}
            <Muted>DB-IP + iptoasn, resolved locally</Muted>
          </Fact>
        ) : null}
      </KVList>
    </>
  );
}
