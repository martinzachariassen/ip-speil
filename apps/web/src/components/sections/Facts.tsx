import { FindingList } from "@martinzachariassen/design";
import type { ReactNode } from "react";
import { flag, formatPlace, isSuccessfulLookup, networkLabel } from "../../lib/format.ts";
import type { GlossaryKey } from "../../lib/glossary.tsx";
import { timezoneCheck } from "../../lib/heuristics.ts";
import { Warning } from "../../lib/icons.tsx";
import type { Exits, IpInfo } from "../../types.ts";
import { Absent, Finding, Footnote, KV, KVList, MonoSm, Muted } from "../primitives.tsx";

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
 * Where your traffic comes out and whose network that is: the exits this page
 * measured, then the operator, ASN and reverse DNS behind them.
 *
 * These used to be two sections — "Exit & network" and "The connection" — which
 * both reported on the same IPv6 exit and neither of which had enough rows to
 * hold a column on its own. They are one question, so they're one section.
 *
 * The exits are measured in the browser and survive a failed lookup; everything
 * downstream of the IP database doesn't, which is why only that half falls back.
 */
export function NetworkFacts({
  d,
  exits,
  ipv6Info,
}: {
  d: IpInfo;
  exits: Exits;
  ipv6Info: IpInfo | null;
}) {
  const ok = isSuccessfulLookup(d);
  const nav = performance.getEntriesByType("navigation")[0] as
    | PerformanceNavigationTiming
    | undefined;

  const countryDiffers =
    ipv6Info?.countryCode && d?.countryCode && ipv6Info.countryCode !== d.countryCode;
  const asDiffers = ipv6Info?.as && d?.as && ipv6Info.as !== d.as;
  const splitRouting = Boolean(exits.v4 && exits.http && exits.v4 !== exits.http);
  const v6Mismatch = Boolean(exits.v6 && (countryDiffers || asDiffers));

  return (
    <>
      {/* Only the two ways this can genuinely go wrong. A bordered note saying
          "IPv6 is reachable, which is normal" is a sentence the reader has to
          process to learn nothing. */}
      {splitRouting || v6Mismatch ? (
        <FindingList className="mb-4">
          {splitRouting ? (
            <Finding
              severity="warn"
              tip="splitRouting"
              title="IPv4 exit differs from the address the server saw"
            >
              Your forced-IPv4 exit is a different address than this page was contacted from — split
              routing or a proxy.
            </Finding>
          ) : null}
          {v6Mismatch ? (
            <Finding severity="warn" title="IPv4 and IPv6 leave through different networks">
              One of the two bypasses whatever you expected to carry your traffic — a common way for
              a VPN to leak.
            </Finding>
          ) : null}
        </FindingList>
      ) : null}

      <KVList>
        {exits.http ? (
          <Fact label="HTTP exit IP" tip="exitIp">
            <MonoSm>{exits.http}</MonoSm>
          </Fact>
        ) : null}
        {exits.v4 ? (
          <Fact label="IPv4 exit">
            <MonoSm>{exits.v4}</MonoSm>
          </Fact>
        ) : null}
        <Fact label="IPv6 exit" tip="ipv6">
          {exits.v6 ? <MonoSm>{exits.v6}</MonoSm> : <Muted>not detected</Muted>}
        </Fact>
        {ok ? (
          <>
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
              {d.hosting
                ? "Datacenter or hosting"
                : d.mobile
                  ? "Mobile / cellular"
                  : "Consumer line"}
            </Fact>
          </>
        ) : null}
        {exits.v6 && ipv6Info?.status === "success" ? (
          <>
            <Fact label="IPv6 location">{formatPlace(ipv6Info)}</Fact>
            <Fact label="IPv6 network">{networkLabel(ipv6Info)}</Fact>
          </>
        ) : null}
        {nav?.nextHopProtocol ? (
          <Fact label="This page negotiated">
            <MonoSm>{nav.nextHopProtocol}</MonoSm>
          </Fact>
        ) : null}
      </KVList>

      {ok ? null : (
        <Footnote>Operator, ASN and reverse DNS all need a successful IP lookup.</Footnote>
      )}
    </>
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
  );
}
