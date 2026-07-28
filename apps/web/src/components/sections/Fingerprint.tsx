import type { EntropyEstimate, FingerprintData } from "../../types.ts";
import { KV, Mono, MonoSm, Note, type Severity, SubLabel } from "../primitives.tsx";

const yn = (on: boolean) => (on ? "Available" : "Blocked");

export function Fingerprint({
  fp,
  entropy,
}: {
  fp: FingerprintData;
  entropy: EntropyEstimate;
}) {
  const dot: Severity = entropy.bits >= 26 ? "bad" : entropy.bits >= 18 ? "warn" : "ok";
  const s = fp.storage;
  const c = fp.connection;

  return (
    <>
      <Note
        severity={dot}
        title={`Fingerprint distinctiveness: ${entropy.rarity}`}
        tip="entropy"
        desc={`About ${entropy.bits} bits of identifying information are exposed here — the more distinctive signals, the fewer browsers look like yours. This is a local, order-of-magnitude estimate (EFF Cover Your Tracks method); it is not a "1 in N" population figure, since we measure no population.`}
      />

      {entropy.contributions.length ? (
        <>
          <SubLabel>What makes this browser identifiable</SubLabel>
          {entropy.contributions.map((contribution) => (
            <KV key={contribution.label} k={contribution.label}>
              {contribution.bits === 1 ? `~${contribution.bits} bit` : `~${contribution.bits} bits`}
            </KV>
          ))}
        </>
      ) : null}

      {fp.canvas ? (
        <KV k="Canvas fingerprint" tip="canvasFp">
          <Mono>{fp.canvas}…</Mono>
        </KV>
      ) : null}
      {fp.audio ? (
        <KV k="Audio fingerprint" tip="audioFp">
          <Mono>{fp.audio}…</Mono>
        </KV>
      ) : null}
      {fp.webgl ? (
        <>
          <KV k="GPU renderer" tip="gpuRenderer">
            {fp.webgl.renderer}
          </KV>
          <KV k="GPU vendor">{fp.webgl.vendor}</KV>
        </>
      ) : null}
      <KV k="Screen">
        <MonoSm>{fp.screen}</MonoSm>
      </KV>
      <KV k="Device pixel ratio">{fp.dpr}×</KV>
      {fp.cpu ? <KV k="CPU threads">{fp.cpu}</KV> : null}
      {fp.memory ? <KV k="Device memory">{fp.memory} GB</KV> : null}
      <KV k="Touch support">{fp.touch > 0 ? `Yes (${fp.touch} points)` : "No"}</KV>
      <KV k="Color gamut">{fp.gamut}</KV>
      <KV k="HDR">{fp.hdr ? "Yes" : "No"}</KV>
      <KV k="Platform">{fp.platform}</KV>
      {fp.fonts.length ? <KV k="Fonts detected">{fp.fonts.length} of a common set</KV> : null}
      {fp.voices ? <KV k="Speech voices">{fp.voices}</KV> : null}
      {fp.devices ? (
        <KV k="Media devices">
          {fp.devices.audioIn} mic · {fp.devices.audioOut} out · {fp.devices.videoIn} cam
        </KV>
      ) : null}

      <SubLabel>Storage &amp; state surfaces</SubLabel>
      <KV k="Cookies">{yn(s.cookies)}</KV>
      <KV k="localStorage">{yn(s.localStorage)}</KV>
      <KV k="sessionStorage">{yn(s.sessionStorage)}</KV>
      <KV k="IndexedDB">{yn(s.indexedDB)}</KV>
      <KV k="Cache API">{yn(s.cacheAPI)}</KV>
      <KV k="Service workers">{yn(s.serviceWorker)}</KV>
      <KV k="Storage Access API">{yn(s.storageAccessApi)}</KV>
      {s.quotaMb != null ? <KV k="Storage quota">~{s.quotaMb.toLocaleString()} MB</KV> : null}

      {c ? (
        <>
          <SubLabel>Connection — also a tracking signal</SubLabel>
          {c.type ? <KV k="Type">{c.type}</KV> : null}
          {c.effectiveType ? <KV k="Effective type">{c.effectiveType}</KV> : null}
          {c.downlink != null ? <KV k="Est. downlink">{c.downlink} Mbps</KV> : null}
          {c.rtt != null ? <KV k="RTT">{c.rtt} ms</KV> : null}
          {c.saveData != null ? <KV k="Data saver">{c.saveData ? "On" : "Off"}</KV> : null}
        </>
      ) : null}
    </>
  );
}
