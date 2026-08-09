import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  SectionHeading,
} from "@martinzachariassen/design";
import type { ReactNode } from "react";
import type { Scan } from "../hooks/useScan.ts";
import { Dot, SEVERITY_LABEL, type Severity, Skel } from "./primitives.tsx";
import { Fingerprint, fingerprintSummary } from "./sections/Fingerprint.tsx";
import { Headers } from "./sections/Headers.tsx";
import { WebRTC, webrtcSummary } from "./sections/WebRTC.tsx";

/**
 * The reference half of the page: the raw candidate list, every fingerprint
 * signal, and the full header dump.
 *
 * They belong together and they open independently, which is an `Accordion` —
 * the design system says as much ("a row of independent `Collapsible`s is an
 * accordion with the keyboard support left out"), and it brings the arrow-key
 * pattern between the triggers. As three separate folding headings they read as
 * three things left over at the bottom of the sheet; as one ruled group under
 * one heading they read as an index, and each row can spend the full width of
 * the page saying what it holds.
 *
 * Nothing here is new information — every one of these has already been judged
 * up in the band and the leak checks. That's what makes it safe to fold.
 */
export function Readouts({ scan }: { scan: Scan | null }) {
  const webrtc = scan ? webrtcSummary(scan.webrtc, scan.data.query) : null;
  const fp = scan ? fingerprintSummary(scan.entropy) : null;
  const headerCount = scan ? Object.keys(scan.headers).length : 0;

  return (
    // A rule and a wide margin. Without them the first row started level with
    // whatever the two-column sheet above happened to end on, and read as one
    // more column of it.
    <section className="mt-16 border-line border-t pt-11">
      <SectionHeading as="h2">The full readout</SectionHeading>
      <p className="mt-2.5 mb-5 max-w-[76ch] text-[13.5px] text-ink-soft">
        Everything the checks above were drawn from, unsummarised. Open what you want to see.
      </p>

      <Accordion type="multiple">
        <Readout
          value="webrtc"
          title="WebRTC candidates"
          summary={webrtc && <Summary severity={webrtc.severity}>{webrtc.text}</Summary>}
        >
          {scan ? <WebRTC webrtc={scan.webrtc} httpIp={scan.data.query} /> : <SkelBlock />}
        </Readout>

        <Readout
          value="fingerprint"
          title="Browser fingerprint"
          summary={fp && <Summary severity={fp.severity}>{fp.text}</Summary>}
        >
          {scan ? <Fingerprint fp={scan.fp} entropy={scan.entropy} /> : <SkelBlock />}
        </Readout>

        <Readout
          value="headers"
          title="What the server sees"
          summary={
            scan ? (
              <Summary severity="off">
                {headerCount} headers were sent to this page unprompted
              </Summary>
            ) : null
          }
        >
          {scan ? <Headers headers={scan.headers} /> : <SkelBlock />}
        </Readout>
      </Accordion>
    </section>
  );
}

function Readout({
  value,
  title,
  summary,
  children,
}: {
  value: string;
  title: string;
  summary: ReactNode;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value} className="border-line first:border-t">
      {/* The row is title · what it found · chevron. The title column is fixed
          from `lg` so the three summaries start on the same vertical, which is
          what makes the group read as an index rather than three headings.
          Below that they stack — inside one flex child, so the chevron stays
          centred at the right of the row instead of being pushed onto a line of
          its own by the wrap. */}
      <AccordionTrigger className="cursor-pointer py-3.5 hover:text-accent-deep focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper">
        <span className="flex min-w-0 flex-1 flex-col gap-1 lg:flex-row lg:items-center lg:gap-6">
          <span className="font-bold font-mono text-[11px] text-ink uppercase tracking-[0.18em] lg:w-56 lg:shrink-0">
            {title}
          </span>
          {summary}
        </span>
      </AccordionTrigger>
      <AccordionContent className="pt-1 pb-9 text-base text-ink">{children}</AccordionContent>
    </AccordionItem>
  );
}

function Summary({ severity, children }: { severity: Severity; children: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5 text-[13px] text-ink-soft">
      <Dot severity={severity} label={SEVERITY_LABEL[severity]} />
      <span className="min-w-0">{children}</span>
    </span>
  );
}

function SkelBlock() {
  return <Skel className="block h-24 w-full rounded" />;
}
