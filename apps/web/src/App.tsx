import { Container } from "@martinzachariassen/design";
import { type ReactNode, useMemo, useState } from "react";
import { ExposureBand } from "./components/ExposureBand.tsx";
import { Footer } from "./components/Footer.tsx";
import { type Family, Hero } from "./components/Hero.tsx";
import { MobileActions } from "./components/MobileActions.tsx";
import { Section } from "./components/Section.tsx";
import { SiteHeader } from "./components/SiteHeader.tsx";
import { Verdict } from "./components/Verdict.tsx";
import type { PageActions } from "./components/actions.ts";
import { Dot, SEVERITY_LABEL, type Severity, Skel } from "./components/primitives.tsx";
import { Browser } from "./components/sections/Browser.tsx";
import { Connection, ConnectionSecurity } from "./components/sections/Connection.tsx";
import { Diff, Shared } from "./components/sections/Diff.tsx";
import { GeoFacts, NetworkFacts } from "./components/sections/Facts.tsx";
import { Fingerprint, fingerprintSummary } from "./components/sections/Fingerprint.tsx";
import { Headers } from "./components/sections/Headers.tsx";
import { Privacy } from "./components/sections/Privacy.tsx";
import { Routing } from "./components/sections/Routing.tsx";
import { WebRTC, webrtcSummary } from "./components/sections/WebRTC.tsx";
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

// The line a folded section shows instead of its contents: a dot, then what it
// found. The dot never carries the meaning on its own — the words next to it say
// the same thing — but it lets someone scanning the page spot the one section
// worth opening.
function Summary({
  severity,
  text,
  children,
}: {
  severity: Severity;
  text?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <Dot severity={severity} label={SEVERITY_LABEL[severity]} />
      <span>{text ?? children}</span>
    </>
  );
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

  const webrtc = useMemo(
    () => (scan ? webrtcSummary(scan.webrtc, scan.data.query) : null),
    [scan],
  );
  const fp = useMemo(() => (scan ? fingerprintSummary(scan.entropy) : null), [scan]);

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
          verdict={<Verdict verdict={exposure?.verdict ?? null} />}
        />

        <ExposureBand items={exposure ? bandItems(exposure.items) : null} />

        {shared ? (
          <Section title="Shared snapshot" className="mt-10">
            <Shared report={shared} />
          </Section>
        ) : null}

        {/* The sheet. Short fact lists flow in two columns from `lg`; the long
            readouts below run full width, because a header dump or a fingerprint
            table in a half-width column leaves a column-height void beside it.
            Leak checks leads: it is both the section people came for and by far
            the tallest, and a column flow balances around its biggest block —
            put it later and the left column runs out halfway down the page. */}
        <div className="pt-11 lg:columns-2 lg:gap-14">
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

          <Section title="Exit &amp; network">
            {scan ? <NetworkFacts d={scan.data} exits={scan.exits} /> : <SkelBlock />}
          </Section>

          <Section title="Where they place you">
            {scan ? <GeoFacts d={scan.data} /> : <SkelBlock />}
          </Section>

          <Section title="The connection">
            {scan ? (
              <Connection exits={scan.exits} ipv6Info={scan.ipv6Info} httpInfo={scan.data} />
            ) : (
              <SkelBlock />
            )}
          </Section>

          {/* Its own heading, not a sub-heading at the bottom of the exits: what
              an observer on the path can see is a different question from where
              your traffic comes out. */}
          <Section title="Connection security">
            {scan ? <ConnectionSecurity cfTrace={scan.cfTrace} /> : <SkelBlock />}
          </Section>

          <Section title="Your browser">
            {scan ? <Browser d={scan.data} /> : <SkelBlock />}
          </Section>

          <Section title="Routing &amp; RPKI">
            {scan ? <Routing d={scan.data} /> : <SkelBlock />}
          </Section>
        </div>

        {/* The three long readouts. They're the reference half of the page —
            everything they contain has already been judged above, in the band and
            the leak checks — so they open on request and say what they hold while
            they're shut. */}
        <Section title="WebRTC candidates" collapsible summary={webrtc && <Summary {...webrtc} />}>
          {scan ? <WebRTC webrtc={scan.webrtc} httpIp={scan.data.query} /> : <SkelBlock />}
        </Section>

        <Section title="Browser fingerprint" collapsible summary={fp && <Summary {...fp} />}>
          {scan ? <Fingerprint fp={scan.fp} entropy={scan.entropy} /> : <SkelBlock />}
        </Section>

        <Section
          title="What the server sees"
          collapsible
          summary={
            scan ? (
              <Summary severity="off">
                {Object.keys(scan.headers).length} headers were sent to this page unprompted
              </Summary>
            ) : null
          }
        >
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
