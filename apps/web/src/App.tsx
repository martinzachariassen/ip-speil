import { Callout, Container, Grid, GridBackground } from "@martinzachariassen/design";
import { useMemo, useState } from "react";
import { BentoCard, SectionLabel } from "./components/BentoCard.tsx";
import { Footer } from "./components/Footer.tsx";
import { type Family, Hero } from "./components/Hero.tsx";
import { MobileActions } from "./components/MobileActions.tsx";
import { SiteHeader } from "./components/SiteHeader.tsx";
import { StatusStripe } from "./components/StatusStripe.tsx";
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
import { useMediaQuery } from "./hooks/useMediaQuery.ts";
import { useScan } from "./hooks/useScan.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { computeExposure } from "./lib/exposure.ts";
import { decodeShare, encodeShare } from "./lib/snapshot.ts";

// The read-only shared report is decoded once from the URL fragment; it never
// reaches the server.
function readSharedReport() {
  return location.hash.startsWith("#r=") ? decodeShare(location.hash.slice(3)) : null;
}

function SkelBlock() {
  return <Skel className="block h-16 w-full rounded-lg" />;
}

export function App() {
  const { scan, loading, report, diff, load, takeSnapshot, clearSnapshot } = useScan();
  const { theme, toggle } = useTheme();
  const shared = useMemo(readSharedReport, []);
  const [family, setFamily] = useState<Family>("v4");
  const [status, setStatus] = useState("");
  const [snapshotFlash, flashSnapshot] = useFlash();

  // The bento tiles from `lg` up; below that it's a stack, and a stack of ten
  // open cards is a very long page. So on a phone everything but the first two
  // starts folded.
  const wide = useMediaQuery("(min-width: 64rem)");

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
    () =>
      report ? `${location.origin}${location.pathname}#r=${encodeShare(report)}` : null,
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
    theme,
    onToggleTheme: toggle,
    announce: setStatus,
  };

  const fpBadge =
    scan && scan.entropy.bits >= 18 ? (
      <span className="font-mono text-[10px] text-warning-deep uppercase tracking-[0.12em]">
        1 notice
      </span>
    ) : undefined;

  return (
    <div className="relative min-h-dvh pb-20 lg:pb-0">
      {/* The engineering-notebook grid, behind everything. `-z-10` keeps it under
          the static content — an absolutely-positioned sibling would otherwise
          paint over it. */}
      <GridBackground cell={28} className="-z-10" />

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

        {exposure ? (
          <Callout
            variant={severityVariant(exposure.verdict.severity)}
            title={exposure.verdict.title}
            description={exposure.verdict.sub}
            pulse
            className="mb-5"
          />
        ) : null}

        <StatusStripe items={exposure?.items ?? null} />

        {shared ? (
          <section className="mb-6" aria-label="Shared snapshot">
            <SectionLabel>Shared snapshot</SectionLabel>
            <Shared report={shared} />
          </section>
        ) : null}

        <SectionLabel>
          The detail <span>— every reading behind the summary</span>
        </SectionLabel>

        <Grid cols={6} gap="md" className="items-start pb-3">
          <BentoCard num="I" title="Your network" span={2} defaultOpen>
            {scan ? <NetworkFacts d={scan.data} exits={scan.exits} /> : <SkelBlock />}
          </BentoCard>

          <BentoCard num="II" title="Where they place you" span={2} defaultOpen>
            {scan ? <GeoFacts d={scan.data} /> : <SkelBlock />}
          </BentoCard>

          <BentoCard num="III" title="Your browser" span={2} defaultOpen={wide}>
            {scan ? <Browser d={scan.data} /> : <SkelBlock />}
          </BentoCard>

          <BentoCard num="IV" title="The connection" span={3} defaultOpen={wide}>
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
          </BentoCard>

          <BentoCard num="V" title="Privacy checks" span={3} defaultOpen={wide}>
            {scan ? (
              <Privacy
                d={scan.data}
                webrtc={scan.webrtc}
                dnsLeak={scan.dnsLeak}
                doh={scan.doh}
                dnssec={scan.dnssec}
              />
            ) : (
              <SkelBlock />
            )}
          </BentoCard>

          <BentoCard num="VI" title="WebRTC leak test" span={3} defaultOpen={wide}>
            {scan ? <WebRTC webrtc={scan.webrtc} httpIp={scan.data.query} /> : <SkelBlock />}
          </BentoCard>

          <BentoCard num="VII" title="Routing & RPKI" span={3} defaultOpen={wide}>
            {scan ? <Routing d={scan.data} /> : <SkelBlock />}
          </BentoCard>

          {/* From here down the readouts are long — a fingerprint table or a
              header dump in a half-width column leaves a column-height void
              beside it. Short fact lists tile; long ones take the full width. */}
          <BentoCard
            num="VIII"
            title="Browser fingerprint"
            span={6}
            defaultOpen={wide}
            badge={fpBadge}
          >
            {scan ? <Fingerprint fp={scan.fp} entropy={scan.entropy} /> : <SkelBlock />}
          </BentoCard>

          <BentoCard num="IX" title="What the server sees" span={6} defaultOpen={wide}>
            {scan ? <Headers headers={scan.headers} /> : <SkelBlock />}
          </BentoCard>

          <BentoCard
            num="X"
            title="Snapshot & changes"
            span={6}
            defaultOpen={wide && Boolean(diff)}
          >
            {diff ? (
              <Diff diff={diff} onClear={clearSnapshot} />
            ) : (
              <p className="text-[14px] text-ink-soft">
                Nothing saved yet. Take a snapshot, change something about your connection — turn a
                VPN on, switch networks — and come back to see exactly what moved.
              </p>
            )}
          </BentoCard>
        </Grid>

        <Footer />
      </Container>

      <MobileActions actions={actions} />
    </div>
  );
}
