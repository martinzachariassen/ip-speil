import { Callout, Container } from "@martinzachariassen/design";
import { useMemo, useState } from "react";
import { ExposureBand } from "./components/ExposureBand.tsx";
import { Footer } from "./components/Footer.tsx";
import { type Family, Hero } from "./components/Hero.tsx";
import { MobileActions } from "./components/MobileActions.tsx";
import { Section } from "./components/Section.tsx";
import { SiteHeader } from "./components/SiteHeader.tsx";
import type { PageActions } from "./components/actions.ts";
import { severityVariant, Skel } from "./components/primitives.tsx";
import { Browser } from "./components/sections/Browser.tsx";
import { Diff, Shared } from "./components/sections/Diff.tsx";
import { GeoFacts, NetworkFacts } from "./components/sections/Facts.tsx";
import { Fingerprint } from "./components/sections/Fingerprint.tsx";
import { Headers } from "./components/sections/Headers.tsx";
import { IPv6 } from "./components/sections/IPv6.tsx";
import { Privacy } from "./components/sections/Privacy.tsx";
import { Routing } from "./components/sections/Routing.tsx";
import { WebRTC } from "./components/sections/WebRTC.tsx";
import { useFlash } from "./hooks/useFlash.ts";
import { useScan } from "./hooks/useScan.ts";
import { bandItems, computeExposure } from "./lib/exposure.ts";
import { decodeShare, encodeShare } from "./lib/snapshot.ts";

// The read-only shared report is decoded once from the URL fragment; it never
// reaches the server.
function readSharedReport() {
  return location.hash.startsWith("#r=") ? decodeShare(location.hash.slice(3)) : null;
}

function SkelBlock() {
  return <Skel className="block h-24 w-full rounded" />;
}

export function App() {
  const { scan, loading, report, diff, load, takeSnapshot, clearSnapshot } = useScan();
  const shared = useMemo(readSharedReport, []);
  const [family, setFamily] = useState<Family>("v4");
  const [status, setStatus] = useState("");
  const [snapshotFlash, flashSnapshot] = useFlash();

  const exposure = useMemo(
    () =>
      scan
        ? computeExposure({
            d: scan.data,
            webrtc: scan.webrtc,
            dnsLeak: scan.dnsLeak,
            doh: scan.doh,
            entropy: scan.entropy,
          })
        : null,
    [scan],
  );

  const reportJson = useMemo(() => (report ? JSON.stringify(report, null, 2) : null), [report]);
  const shareUrl = useMemo(
    () => (report ? `${location.origin}${location.pathname}#r=${encodeShare(report)}` : null),
    [report],
  );

  const actions: PageActions = {
    loading,
    onRefresh: load,
    reportJson,
    shareUrl,
    onSnapshot: () => {
      if (!report) return;
      takeSnapshot();
      flashSnapshot("Saved");
      setStatus("Snapshot saved locally");
    },
    snapshotFlash,
    announce: setStatus,
  };

  return (
    <div className="min-h-dvh pb-20 lg:pb-0">
      <SiteHeader actions={actions} />

      {/* One polite live region for every action's outcome; the visible label
          swaps cover sighted users. */}
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      <Container size="xl" className="pb-4">
        <Hero
          scan={scan}
          loading={loading}
          family={family}
          onFamilyChange={setFamily}
          onAnnounce={setStatus}
        />

        <ExposureBand items={exposure ? bandItems(exposure.items) : null} />

        {/* The one place a box is still right: a single statement the reader is
            meant to act on, above a page of readings that only report. */}
        {exposure && exposure.verdict.severity !== "ok" ? (
          <Callout
            variant={severityVariant(exposure.verdict.severity)}
            title={exposure.verdict.title}
            description={exposure.verdict.sub}
            pulse
            className="mt-7"
          />
        ) : null}

        {shared ? (
          <Section title="Shared snapshot" className="mt-10">
            <Shared report={shared} />
          </Section>
        ) : null}

        {/* The sheet. Short fact lists flow in two columns from `lg`; the long
            readouts below run full width, because a header dump or a fingerprint
            table in a half-width column leaves a column-height void beside it. */}
        <div className="pt-11 lg:columns-2 lg:gap-14">
          <Section title="Exit &amp; network">
            {scan ? <NetworkFacts d={scan.data} exits={scan.exits} /> : <SkelBlock />}
          </Section>

          <Section title="Where they place you">
            {scan ? <GeoFacts d={scan.data} /> : <SkelBlock />}
          </Section>

          <Section title="The connection">
            {scan ? (
              <IPv6
                exits={scan.exits}
                ipv6Info={scan.ipv6Info}
                cfTrace={scan.cfTrace}
                httpInfo={scan.data}
              />
            ) : (
              <SkelBlock />
            )}
          </Section>

          <Section title="Your browser">
            {scan ? <Browser d={scan.data} /> : <SkelBlock />}
          </Section>

          <Section title="Leak checks">
            {scan ? (
              <Privacy
                d={scan.data}
                webrtc={scan.webrtc}
                dnsLeak={scan.dnsLeak}
                doh={scan.doh}
                dnssec={scan.dnssec}
                entropy={scan.entropy}
              />
            ) : (
              <SkelBlock />
            )}
          </Section>

          <Section title="Routing &amp; RPKI">
            {scan ? <Routing d={scan.data} /> : <SkelBlock />}
          </Section>
        </div>

        <Section title="WebRTC candidates">
          {scan ? <WebRTC webrtc={scan.webrtc} httpIp={scan.data.query} /> : <SkelBlock />}
        </Section>

        <Section title="Browser fingerprint">
          {scan ? <Fingerprint fp={scan.fp} entropy={scan.entropy} /> : <SkelBlock />}
        </Section>

        <Section title="What the server sees">
          {scan ? <Headers headers={scan.headers} /> : <SkelBlock />}
        </Section>

        <Section title="Snapshot &amp; changes">
          {diff ? (
            <Diff diff={diff} onClear={clearSnapshot} />
          ) : (
            <p className="m-0 max-w-[62ch] text-[13.5px] text-ink-soft">
              Nothing saved yet. Take a snapshot, change something about your connection — turn a
              VPN on, switch networks — and come back to see exactly what moved.
            </p>
          )}
        </Section>

        <Footer />
      </Container>

      <MobileActions actions={actions} />
    </div>
  );
}
