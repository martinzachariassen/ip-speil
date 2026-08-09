import { Separator, Text } from "@martinzachariassen/design";
import type { Verdict as VerdictData } from "../lib/exposure.ts";
import { Dot, SEVERITY_LABEL, Skel } from "./primitives.tsx";

/**
 * What the whole scan adds up to, in one sentence.
 *
 * It sits in the hero, opposite the hand-written note, because that is where the
 * question is asked — the reader is looking at their address and wants to know
 * whether it's a problem. Left where it used to be, between the readout band and
 * the sheet, it was a dot-led line among twenty other dot-led lines, saying
 * nothing the band hadn't already said and belonging to neither neighbour.
 *
 * The eyebrow is what makes it read as a conclusion rather than one more
 * finding, and the rule above it closes the hero. It renders on a clean scan
 * too: "nothing is leaking" is the answer people came for, and a verdict that
 * only appears when something is wrong makes the page jump between visits.
 */
export function Verdict({ verdict }: { verdict: VerdictData | null }) {
  return (
    <div>
      <Separator className="mb-3.5" />
      <Text variant="eyebrow" as="p" className="mb-2 text-ink-faint">
        What this adds up to
      </Text>
      {verdict ? (
        <div className="flex gap-2.5">
          <Dot
            severity={verdict.severity}
            label={SEVERITY_LABEL[verdict.severity]}
            className="mt-[0.6em]"
            pulse={verdict.severity !== "ok"}
          />
          <div className="min-w-0">
            <p className="m-0 font-grotesk font-medium text-[17px] text-ink leading-snug">
              {verdict.title}
            </p>
            <p className="mt-1 mb-0 text-[13px] text-ink-soft leading-relaxed">{verdict.sub}</p>
          </div>
        </div>
      ) : (
        <div aria-hidden="true">
          <Skel className="mb-2 block h-4 w-[22ch] max-w-full" />
          <Skel className="block h-3 w-[26ch] max-w-full" />
        </div>
      )}
    </div>
  );
}
