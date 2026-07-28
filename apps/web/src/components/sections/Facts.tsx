import { flag, formatPlace, isSuccessfulLookup } from "../../lib/format.ts";
import { type GlossaryKey, Tip } from "../../lib/glossary.tsx";
import { timezoneCheck } from "../../lib/heuristics.ts";
import type { Exits, IpInfo } from "../../types.ts";
import type { ReactNode } from "react";
import { Icon } from "@martinzachariassen/design";
import { MonoSm, Muted } from "../primitives.tsx";

// One label/value row in the "Connection details" grid. Collapses to a single
// column on narrow screens.
function Fact({ label, tip, children }: { label: string; tip?: GlossaryKey; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[124px_1fr] items-baseline gap-[18px] border-b border-line-soft py-3 max-[560px]:grid-cols-1 max-[560px]:gap-1">
      <div className="flex items-center gap-1.5 font-mono text-[10.5px] tracking-[0.13em] text-ink-faint uppercase">
        {label}
        {tip ? <Tip k={tip} /> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2.5 break-words text-[14.5px] text-ink">
        {children}
      </div>
    </div>
  );
}

export function Facts({ d, exits }: { d: IpInfo; exits: Exits }) {
  const ipv6Fact = exits.v6 ? <MonoSm>{exits.v6}</MonoSm> : <Muted>not detected</Muted>;

  if (!isSuccessfulLookup(d)) {
    return (
      <div className="border-t border-line">
        <Fact label="Status">
          <Muted>IP lookup unavailable — try Refresh</Muted>
        </Fact>
        <Fact label="IPv6" tip="ipv6">
        {ipv6Fact}
      </Fact>
      </div>
    );
  }

  const tz = timezoneCheck(d);
  const tzWarn = tz.nameMismatch || tz.offsetMismatch;
  const place = formatPlace(d);
  const f = flag(d.countryCode);

  return (
    <div className="border-t border-line">
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
      <Fact label="Timezone">
        <span>{d.timezone || tz.browserTz}</span>
        {tzWarn ? (
          <Muted>
            browser: {tz.browserTz}{" "}
            <Icon
              name="triangle-alert"
              size="xs"
              label="timezone mismatch"
              className="inline-block align-[-2px] text-warn"
            />
          </Muted>
        ) : null}
      </Fact>
      <Fact label="IPv6" tip="ipv6">
        {ipv6Fact}
      </Fact>
    </div>
  );
}
