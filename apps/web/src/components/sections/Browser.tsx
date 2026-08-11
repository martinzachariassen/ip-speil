import { languageGeoCheck, timezoneCheck } from "../../lib/heuristics.ts";
import type { IpInfo } from "../../types.ts";
import { Warning } from "../../lib/icons.tsx";
import { BodyIntro, Columns, KV, KVList, Mono, halves } from "../primitives.tsx";

export function Browser({ d }: { d: IpInfo }) {
  const tz = timezoneCheck(d);
  const tzMismatch = tz.nameMismatch || tz.offsetMismatch;
  const langGeo = languageGeoCheck(d.countryCode);
  const dnt =
    navigator.doNotTrack === "1"
      ? "Enabled"
      : navigator.doNotTrack === "0"
        ? "Disabled"
        : "Not set";
  const gpc =
    navigator.globalPrivacyControl === true
      ? "Enabled"
      : navigator.globalPrivacyControl === false
        ? "Disabled"
        : "Not set";
  const languages = (navigator.languages || [navigator.language]).join(", ");

  const rows = [
    <KV key="timezone" k="Timezone" mono>
      {tz.browserTz}
      {tzMismatch ? (
        <>
          <Warning className="ml-1.5 inline-block align-[-2px] text-warning-deep" />
          <span className="sr-only">timezone mismatch</span>
        </>
      ) : null}
    </KV>,
    <KV key="language" k="Language" mono>
      {navigator.language}
    </KV>,
    <KV key="all-languages" k="All languages" mono>
      {languages}
    </KV>,
    <KV key="dnt" k="Do Not Track" tip="doNotTrack">
      {dnt}
    </KV>,
    <KV key="gpc" k="Global Privacy Control" tip="gpc">
      {gpc}
    </KV>,
    <KV key="cookies" k="Cookies">
      {navigator.cookieEnabled ? "Enabled" : "Disabled"}
    </KV>,
    <KV key="ua" k="User agent" tip="userAgent">
      <Mono>{navigator.userAgent}</Mono>
    </KV>,
  ];
  const [left, right] = halves(rows);

  return (
    <>
      {tzMismatch ? (
        <BodyIntro>
          Timezone mismatch — browser is <b className="text-ink">{tz.browserTz}</b> but your IP
          resolves to <b className="text-ink">{d.timezone || "unknown"}</b>. Possible timezone
          spoofing or VPN mismatch.
        </BodyIntro>
      ) : null}
      {langGeo.mismatch ? (
        <BodyIntro>
          Browser locale region <b className="text-ink">{langGeo.langRegion}</b> differs from your IP
          country <b className="text-ink">{d.countryCode}</b> — common when travelling or using a
          VPN.
        </BodyIntro>
      ) : null}
      <Columns>
        <KVList>{left}</KVList>
        {right.length ? <KVList>{right}</KVList> : null}
      </Columns>
    </>
  );
}
