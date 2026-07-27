import { useMemo } from "react";
import { Rail } from "./components/Rail.tsx";
import { Reveal } from "./components/Reveal.tsx";
import { FinePrint, Footer } from "./components/FinePrint.tsx";
import { Button, Skel } from "./components/primitives.tsx";
import { Browser } from "./components/sections/Browser.tsx";
import { Diff, Shared } from "./components/sections/Diff.tsx";
import { Exposure } from "./components/sections/Exposure.tsx";
import { Facts } from "./components/sections/Facts.tsx";
import { Fingerprint } from "./components/sections/Fingerprint.tsx";
import { Headers } from "./components/sections/Headers.tsx";
import { IPv6 } from "./components/sections/IPv6.tsx";
import { Privacy } from "./components/sections/Privacy.tsx";
import { Routing } from "./components/sections/Routing.tsx";
import { WebRTC } from "./components/sections/WebRTC.tsx";
import { useScan } from "./hooks/useScan.ts";
import { useTheme } from "./hooks/useTheme.ts";
import { computeExposure } from "./lib/exposure.ts";
import { decodeShare, encodeShare } from "./lib/snapshot.ts";
import type { ReactNode } from "react";

// The read-only shared report is decoded once from the URL fragment; it never
// reaches the server.
function readSharedReport() {
  return location.hash.startsWith("#r=") ? decodeShare(location.hash.slice(3)) : null;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 font-mono text-[10.5px] tracking-[0.14em] text-ink-faint uppercase [&_span]:text-[12px] [&_span]:tracking-normal [&_span]:normal-case">
      {children}
    </div>
  );
}

function SkelBlock() {
  return <Skel className="block h-16 w-full rounded-lg" />;
}

export function App() {
  const { scan, loading, report, diff, load, takeSnapshot, clearSnapshot } = useScan();
  const { theme, toggle } = useTheme();
  const shared = useMemo(readSharedReport, []);

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

  function copyReport(): Promise<boolean> {
    if (!report || !navigator.clipboard) return Promise.resolve(false);
    return navigator.clipboard
      .writeText(JSON.stringify(report, null, 2))
      .then(() => true)
      .catch(() => false);
  }

  function shareLink(): Promise<boolean> {
    if (!report || !navigator.clipboard) return Promise.resolve(false);
    const url = `${location.origin}${location.pathname}#r=${encodeShare(report)}`;
    return navigator.clipboard
      .writeText(url)
      .then(() => true)
      .catch(() => false);
  }

  function snapshot(): boolean {
    if (!report) return false;
    takeSnapshot();
    return true;
  }

  const fpBadge = scan && scan.entropy.bits >= 18 ? "1 notice" : undefined;

  return (
    <div className="min-h-dvh">
      <div className="mx-auto max-w-[1240px] bg-paper min-[900px]:grid min-[900px]:grid-cols-[350px_1fr] min-[1140px]:grid-cols-[385px_1fr] min-[1280px]:border-x min-[1280px]:border-line">
        <Rail
          scan={scan}
          verdict={exposure?.verdict ?? null}
          loading={loading}
          theme={theme}
          onRefresh={load}
          onCopyReport={copyReport}
          onSnapshot={snapshot}
          onShare={shareLink}
          onToggleTheme={toggle}
        />

        <main className="px-5 pt-1.5 pb-[max(34px,env(safe-area-inset-bottom))] min-[900px]:px-[38px] min-[900px]:pt-[30px] min-[900px]:pl-[34px] min-[1140px]:px-[44px] min-[1140px]:pt-[34px] min-[1140px]:pl-10">
          {shared ? (
            <section className="mt-6 min-[900px]:mt-0" aria-label="Shared snapshot">
              <SectionLabel>Shared snapshot</SectionLabel>
              <Shared report={shared} />
            </section>
          ) : null}

          {diff ? (
            <section className="mt-[30px]" aria-label="Changes since your snapshot">
              <div className="mb-2 flex items-center justify-between gap-3">
                <SectionLabel>Since your snapshot</SectionLabel>
                <Button mini onClick={clearSnapshot}>
                  Clear snapshot
                </Button>
              </div>
              <Diff diff={diff} />
            </section>
          ) : null}

          <section
            className="mt-6 first:mt-6 min-[900px]:mt-0 min-[900px]:first:mt-0"
            aria-label="Exposure summary"
          >
            <SectionLabel>What sites can see</SectionLabel>
            {exposure ? <Exposure items={exposure.items} /> : <SkelBlock />}
          </section>

          <section className="mt-[30px]" aria-label="Connection details">
            <SectionLabel>Connection details</SectionLabel>
            {scan ? <Facts d={scan.data} exits={scan.exits} /> : <SkelBlock />}
          </section>

          <div className="mt-[30px]">
            <SectionLabel>
              Deeper look <span>— tap any section to expand</span>
            </SectionLabel>

            <Reveal
              num="01"
              title="Privacy checks"
              subtitle="VPN, proxy, reputation, WebRTC & DNS signals"
            >
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
            </Reveal>

            <Reveal
              num="02"
              title="Your browser"
              subtitle="language, privacy signals & user agent"
            >
              {scan ? <Browser d={scan.data} /> : <SkelBlock />}
            </Reveal>

            <Reveal
              num="03"
              title="IPv6 & routing"
              subtitle="compares IPv4 / IPv6 exit and Cloudflare trace"
            >
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
            </Reveal>

            <Reveal
              num="04"
              title="Browser fingerprint"
              subtitle="how sites track you beyond your IP"
              badge={fpBadge}
            >
              {scan ? <Fingerprint fp={scan.fp} entropy={scan.entropy} /> : <SkelBlock />}
            </Reveal>

            <Reveal
              num="05"
              title="What the server sees"
              subtitle="HTTP headers your browser sent to this page"
            >
              {scan ? <Headers headers={scan.headers} /> : <SkelBlock />}
            </Reveal>

            <Reveal
              num="06"
              title="WebRTC leak test"
              subtitle="peer-to-peer candidates your browser exposes"
            >
              {scan ? <WebRTC webrtc={scan.webrtc} httpIp={scan.data.query} /> : <SkelBlock />}
            </Reveal>

            <Reveal
              num="07"
              title="Routing & RPKI"
              subtitle="BGP prefix, origin ASN and route-origin validation"
            >
              {scan ? <Routing d={scan.data} /> : <SkelBlock />}
            </Reveal>
          </div>

          <FinePrint />
          <Footer />
        </main>
      </div>
    </div>
  );
}
