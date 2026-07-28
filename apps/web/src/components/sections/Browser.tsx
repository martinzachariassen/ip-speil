import { languageGeoCheck, timezoneCheck } from "../../lib/heuristics.ts";
import type { IpInfo } from "../../types.ts";
import { Icon } from "@martinzachariassen/design";
import { BodyIntro, KV, Mono } from "../primitives.tsx";

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
      <KV k="Timezone">
        {tz.browserTz}
        {tzMismatch ? (
          <Icon
            name="triangle-alert"
            size="xs"
            label="timezone mismatch"
            className="ml-1.5 inline-block align-[-2px] text-warn"
          />
        ) : null}
      </KV>
      <KV k="Language">{navigator.language}</KV>
      <KV k="All languages">{languages}</KV>
      <KV k="Do Not Track" tip="doNotTrack">
        {dnt}
      </KV>
      <KV k="Global Privacy Control" tip="gpc">
        {gpc}
      </KV>
      <KV k="Cookies">{navigator.cookieEnabled ? "Enabled" : "Disabled"}</KV>
      <KV k="User agent" tip="userAgent">
        <Mono>{navigator.userAgent}</Mono>
      </KV>
    </>
  );
}
