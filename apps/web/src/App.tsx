import { Container } from "@martinzachariassen/design";
import { useMemo, useState } from "react";
import type { PageActions } from "./components/actions.ts";
import { ExposureBand } from "./components/ExposureBand.tsx";
import { Footer } from "./components/Footer.tsx";
import { type Family, Hero } from "./components/Hero.tsx";
import { MobileActions } from "./components/MobileActions.tsx";
import { Skel } from "./components/primitives.tsx";
import { Readouts } from "./components/Readouts.tsx";
import { Section } from "./components/Section.tsx";
import { SiteHeader } from "./components/SiteHeader.tsx";
import { Browser } from "./components/sections/Browser.tsx";
import { Diff, Shared } from "./components/sections/Diff.tsx";
import { GeoFacts, NetworkFacts } from "./components/sections/Facts.tsx";
import { Privacy } from "./components/sections/Privacy.tsx";
import { Verdict } from "./components/Verdict.tsx";
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
          verdict={<Verdict verdict={exposure?.verdict ?? null} />}
        />

        <ExposureBand items={exposure ? bandItems(exposure.items) : null} />

        {shared ? (
          <Section title="Shared snapshot" className="mt-10">
            <Shared report={shared} />
          </Section>
        ) : null}

        {/* The checks lead the sheet — it's the section people came for — at
            full width, in two columns of findings. */}
        <Section title="Leak checks" className="pt-11">
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

        {/* Two fact lists in an explicit pair, not a CSS column flow. A flow
            balances the *whole* run, so one unbreakable section landing badly
            leaves a screen-tall hole at the foot of a column; a grid bounds the
            slack to the difference within one row.

            Getting the holes out took more than pairing, though. Of the original
            six sections: "The connection" never had more than a few rows and
            reported the same IPv6 exit as "Exit & network", so they're one
            section now; "Routing & RPKI" is either a full registry ledger or a
            single muted line depending on whether RIPEstat answers, so it moved
            into the readout accordion, where its height stops mattering; and
            "Connection security" read the TLS handshake from a client-side fetch
            to Cloudflare's 1.1.1.1/cdn-cgi/trace, which Cloudflare now answers
            with a 503 for cross-origin fetch/XHR (a plain navigation to the same
            URL still gets 200) — so the section always read "couldn't be
            reached" and was removed rather than proxied server-side, which would
            have reported the Worker's handshake with Cloudflare instead of the
            visitor's. */}
        <div className="lg:grid lg:grid-cols-2 lg:gap-x-14">
          <Section title="Exit &amp; network">
            {scan ? (
              <NetworkFacts d={scan.data} exits={scan.exits} ipv6Info={scan.ipv6Info} />
            ) : (
              <SkelBlock />
            )}
          </Section>

          <Section title="Where they place you">
            {scan ? <GeoFacts d={scan.data} /> : <SkelBlock />}
          </Section>
        </div>

        <Section title="Your browser">{scan ? <Browser d={scan.data} /> : <SkelBlock />}</Section>

        <Readouts scan={scan} />

        <Section title="Snapshot &amp; changes" className="mt-12">
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
