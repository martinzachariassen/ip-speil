import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  SectionHeading,
} from "@martinzachariassen/design";
import { type ReactNode, useState } from "react";
import { cx } from "../lib/cx.ts";
import { ChevronDown } from "../lib/icons.tsx";

/**
 * One section of the sheet: a ruled heading and its rows, sitting straight on
 * the page.
 *
 * There is no card here on purpose. Ten boxed panels turn a diagnostic page into
 * a dashboard, where every reading looks equally important and the borders do
 * nothing but repeat; a heading whose rule measures the column does the same
 * structural job for one hairline.
 *
 * `break-inside-avoid` keeps a section whole when the sheet flows into two
 * columns. It's a hint, not a guarantee — a section taller than the column will
 * still split, which is why the long readouts run full width instead.
 *
 * Pass `collapsible` for those long readouts — the raw candidate list, the
 * fingerprint signals, the header dump. They are the reference material of the
 * page: worth having, not worth scrolling past on every visit. A folded section
 * still states what it holds in `summary`, so folding hides the detail and never
 * the finding.
 */
export function Section({
  title,
  summary,
  collapsible,
  defaultOpen = false,
  children,
  className,
}: {
  title: ReactNode;
  /** One line naming what's inside — shown whether the section is open or shut. */
  summary?: ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  if (collapsible) {
    return (
      <FoldingSection title={title} summary={summary} defaultOpen={defaultOpen} className={className}>
        {children}
      </FoldingSection>
    );
  }
  return (
    <section className={cx("mb-9 break-inside-avoid", className)}>
      <SectionHeading as="h2" className="mb-3">
        {title}
      </SectionHeading>
      {summary ? <Summary>{summary}</Summary> : null}
      {children}
    </section>
  );
}

// The line under the heading that says what the section found, in one sentence.
// It stands in for the contents while they're folded away, and steps aside once
// they're open — left up, it repeats the first finding of every section it
// introduces, one line above it.
function Summary({ children }: { children: ReactNode }) {
  return (
    <p className="mt-0 mb-3.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-ink-soft">
      {children}
    </p>
  );
}

function FoldingSection({
  title,
  summary,
  defaultOpen,
  children,
  className,
}: {
  title: ReactNode;
  summary?: ReactNode;
  defaultOpen: boolean;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <section className={cx("mb-9 break-inside-avoid", className)}>
        {/* The canonical disclosure: the button *is* the heading text, so its
            accessible name is the section title and `aria-expanded` carries the
            state. The chevron is the only thing that changes — a label that
            flipped between "Show" and "Hide" would contradict `aria-expanded`,
            which is why the design system's trigger asks for a constant one. */}
        <SectionHeading as="h2" className="mb-3">
          {/* The system's trigger dims its focus ring to 30% for use inside a
              card; standing on bare paper it has to clear 3:1 on its own, so the
              ring goes back to the full `--ring`, which sits on the `-deep` rung
              for exactly this. */}
          <CollapsibleTrigger className="-mx-1.5 -my-1 w-auto cursor-pointer gap-2 rounded px-1.5 py-1 text-[11px] tracking-[0.18em] hover:text-accent-deep focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper">
            {title}
            <ChevronDown
              className={cx(
                "text-ink-soft transition-transform duration-200 motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </CollapsibleTrigger>
        </SectionHeading>
        {summary && !open ? <Summary>{summary}</Summary> : null}
        <CollapsibleContent>{children}</CollapsibleContent>
      </section>
    </Collapsible>
  );
}
