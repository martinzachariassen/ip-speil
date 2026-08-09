import { FindingList } from "@martinzachariassen/design";
import type { ReactNode } from "react";
import type { EntropyEstimate, FingerprintData } from "../../types.ts";
import {
  Finding,
  Footnote,
  KV,
  KVList,
  LedgerColumns,
  Mono,
  MonoSm,
  type Severity,
  SubLabel,
} from "../primitives.tsx";

const distinctiveness = (bits: number): Severity => (bits >= 26 ? "bad" : bits >= 18 ? "warn" : "ok");

// Split a run of rows down the middle so the two ledgers end up the same height.
function halves<T>(rows: T[]): [T[], T[]] {
  const cut = Math.ceil(rows.length / 2);
  return [rows.slice(0, cut), rows.slice(cut)];
}

/** What the section heading says about itself while it's folded shut. */
export function fingerprintSummary(entropy: EntropyEstimate) {
  const top = entropy.contributions.slice(0, 3).map((c) => c.label.toLowerCase());
  return {
    severity: distinctiveness(entropy.bits),
    text: top.length
      ? `~${entropy.bits} bits · ${entropy.rarity} — mostly ${top.join(", ")}`
      : `~${entropy.bits} bits · ${entropy.rarity}`,
  };
}

/**
 * What this browser gives away about itself, and which signals do the most
 * damage.
 *
 * The ranking is the point of the section, so it comes first and on its own; the
 * raw values behind it are reference material and sit below, in two columns. Set
 * as one full-width list they ran to thirty rows of eight-character values
 * against three-quarters of a line of empty paper.
 *
 * The storage audit is a count, not a list. Seven rows that read "Available"
 * every time tell the reader nothing they can act on — what matters is whether
 * anything is *blocked*, and that is one line.
 */
export function Fingerprint({
  fp,
  entropy,
}: {
  fp: FingerprintData;
  entropy: EntropyEstimate;
}) {
  const s = fp.storage;
  const c = fp.connection;

  const surfaces: [string, boolean][] = [
    ["cookies", s.cookies],
    ["localStorage", s.localStorage],
    ["sessionStorage", s.sessionStorage],
    ["IndexedDB", s.indexedDB],
    ["the Cache API", s.cacheAPI],
    ["service workers", s.serviceWorker],
    ["the Storage Access API", s.storageAccessApi],
  ];
  const blocked = surfaces.filter(([, on]) => !on).map(([name]) => name);

  const [leftBits, rightBits] = halves(entropy.contributions);

  const signals: ReactNode[] = [
    fp.canvas ? (
      <KV key="canvas" k="Canvas fingerprint" tip="canvasFp">
        <Mono>{fp.canvas}…</Mono>
      </KV>
    ) : null,
    fp.audio ? (
      <KV key="audio" k="Audio fingerprint" tip="audioFp">
        <Mono>{fp.audio}…</Mono>
      </KV>
    ) : null,
    fp.webgl ? (
      <KV key="gpu" k="GPU renderer" tip="gpuRenderer" mono>
        {fp.webgl.renderer}
      </KV>
    ) : null,
    fp.webgl ? (
      <KV key="gpu-vendor" k="GPU vendor">
        {fp.webgl.vendor}
      </KV>
    ) : null,
    <KV key="platform" k="Platform" mono>
      {fp.platform}
    </KV>,
    <KV key="screen" k="Screen">
      <MonoSm>{fp.screen}</MonoSm>
    </KV>,
    <KV key="dpr" k="Device pixel ratio">
      {fp.dpr}×
    </KV>,
    fp.cpu ? (
      <KV key="cpu" k="CPU threads">
        {fp.cpu}
      </KV>
    ) : null,
    fp.memory ? (
      <KV key="memory" k="Device memory">
        {fp.memory} GB
      </KV>
    ) : null,
    <KV key="touch" k="Touch support">
      {fp.touch > 0 ? `Yes (${fp.touch} points)` : "No"}
    </KV>,
    <KV key="gamut" k="Colour gamut">
      {fp.gamut}
      {fp.hdr ? " · HDR" : ""}
    </KV>,
    fp.fonts.length ? (
      <KV key="fonts" k="Fonts detected">
        {fp.fonts.length} of a common set
      </KV>
    ) : null,
    fp.voices ? (
      <KV key="voices" k="Speech voices">
        {fp.voices}
      </KV>
    ) : null,
    fp.devices ? (
      <KV key="devices" k="Media devices">
        {fp.devices.audioIn} mic · {fp.devices.audioOut} out · {fp.devices.videoIn} cam
      </KV>
    ) : null,
    <KV key="storage" k="Storage surfaces">
      {surfaces.length - blocked.length} of {surfaces.length} available
      {s.quotaMb != null ? ` · ~${s.quotaMb.toLocaleString()} MB quota` : ""}
    </KV>,
    blocked.length ? (
      <KV key="blocked" k="Blocked">
        {blocked.join(", ")}
      </KV>
    ) : null,
    c?.effectiveType ? (
      <KV key="net" k="Network">
        {[c.effectiveType, c.downlink != null ? `${c.downlink} Mbps` : null, c.rtt != null ? `${c.rtt} ms` : null]
          .filter(Boolean)
          .join(" · ")}
      </KV>
    ) : null,
  ].filter(Boolean);

  const [leftSignals, rightSignals] = halves(signals);

  return (
    <>
      <FindingList className="mb-5">
        <Finding
          severity={distinctiveness(entropy.bits)}
          tip="entropy"
          title={`Fingerprint distinctiveness: ${entropy.rarity}`}
        >
          About {entropy.bits} bits of identifying information are exposed here — the more
          distinctive the signals, the fewer browsers look like yours.
        </Finding>
      </FindingList>

      {entropy.contributions.length ? (
        <>
          <SubLabel tip="entropy">What makes this browser identifiable</SubLabel>
          <LedgerColumns>
            <KVList>
              {leftBits.map((contribution) => (
                <KV key={contribution.label} k={contribution.label}>
                  {contribution.bits === 1 ? "~1 bit" : `~${contribution.bits} bits`}
                </KV>
              ))}
            </KVList>
            {rightBits.length ? (
              <KVList>
                {rightBits.map((contribution) => (
                  <KV key={contribution.label} k={contribution.label}>
                    {contribution.bits === 1 ? "~1 bit" : `~${contribution.bits} bits`}
                  </KV>
                ))}
              </KVList>
            ) : null}
          </LedgerColumns>
        </>
      ) : null}

      <SubLabel>The signals behind it</SubLabel>
      <LedgerColumns>
        <KVList>{leftSignals}</KVList>
        {rightSignals.length ? <KVList>{rightSignals}</KVList> : null}
      </LedgerColumns>

      <Footnote>
        This is a local, order-of-magnitude estimate using the EFF Cover Your Tracks method — not a
        &ldquo;1 in N browsers&rdquo; figure, since we measure no population. None of it is sent to
        the server.
      </Footnote>
    </>
  );
}
