import { StatusChip } from "@martinzachariassen/design";
import type { ExposureItem } from "../lib/exposure.ts";
import { Tip } from "../lib/glossary.tsx";
import { SEVERITY_LABEL, severityVariant, Skel } from "./primitives.tsx";

/**
 * The quick read: every exposure finding as one chip, in a row.
 *
 * This is the whole "what sites can see" ledger, not a summary of it — each chip
 * carries the same label, detail and glossary tip the old two-column list did, so
 * nothing moved into the cards below and nothing was dropped.
 *
 * On a phone it becomes a horizontal scroll strip with snap points rather than
 * wrapping into a five-line block: the chips are a glance, and a glance that
 * pushes the rest of the page below the fold isn't one.
 *
 * Severity never rides on colour alone — each chip states its state as
 * screen-reader text, and the label spells out the finding either way.
 */
export function StatusStripe({ items }: { items: ExposureItem[] | null }) {
  if (!items) {
    return (
      <div className="flex gap-2 pb-8" aria-hidden="true">
        <Skel className="h-[34px] w-52 rounded-full" />
        <Skel className="h-[34px] w-40 rounded-full" />
        <Skel className="h-[34px] w-44 rounded-full" />
      </div>
    );
  }

  return (
    <ul
      aria-label="What sites can see"
      // The negative margins cancel `Container`'s gutter exactly so the strip
      // bleeds to the screen edge and no further — they have to track the
      // system's gutter ladder (px-4 / sm:px-6), or the page gains a few pixels
      // of horizontal scroll.
      className="-mx-4 flex list-none snap-x snap-proximity gap-2 overflow-x-auto px-4 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
    >
      {/* `relative` on the item is load-bearing: `sr-only` is `position:
          absolute`, so without a positioned ancestor inside this scroller its
          containing block is the page root — the severity labels then escape the
          horizontal clip and stretch the document by ~870px on a phone. */}
      {items.map((item) => (
        <li key={item.label} className="relative snap-start">
          <StatusChip variant={severityVariant(item.severity)}>
            <span className="sr-only">{SEVERITY_LABEL[item.severity]}: </span>
            {item.label}
            {item.detail ? <span className="text-ink-soft"> · {item.detail}</span> : null}
            {item.tip ? <Tip k={item.tip} /> : null}
          </StatusChip>
        </li>
      ))}
    </ul>
  );
}
