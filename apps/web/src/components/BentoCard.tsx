import {
  Card,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Text,
} from "@martinzachariassen/design";
import type { ReactNode } from "react";
import { useState } from "react";
import { cx } from "../lib/cx.ts";
import { ChevronRight } from "../lib/icons.tsx";

/** How many of the six bento columns the card takes, from `lg` up. */
const SPAN = {
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  6: "lg:col-span-6",
} as const;

interface BentoCardProps {
  /** The card's place in the sequence, set in the serif — i, ii, iii… */
  num: string;
  title: string;
  span?: keyof typeof SPAN;
  /** Whether it starts open. The page passes `false` on phones. */
  defaultOpen?: boolean;
  badge?: ReactNode;
  children: ReactNode;
}

/**
 * One panel of the bento. Below `lg` every card is full width and the whole
 * grid reads as a stacked accordion; from `lg` up the cards tile and the numeral
 * appears.
 *
 * It is a `Collapsible` at every size rather than a card that becomes one — a
 * trigger that exists but refuses to work at some widths is worse than one that
 * always does, and being able to fold a section away on a wide screen is useful
 * in its own right. Only the *initial* state is width-dependent.
 */
export function BentoCard({
  num,
  title,
  span = 2,
  defaultOpen = true,
  badge,
  children,
}: BentoCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={cx("col-span-full overflow-hidden", SPAN[span])}>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-baseline gap-2.5 px-[18px] py-3.5 text-left transition-colors hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
          <h2 className="font-medium text-[15px] text-ink leading-tight">{title}</h2>
          {badge}
          <span className="ml-auto flex items-baseline gap-3">
            {/* The numeral is decoration — the heading already says which card
                this is, and a screen reader reading "i" here would be noise. */}
            <span aria-hidden="true" className="hidden font-serif text-[17px] italic text-ink-faint lg:inline">
              {num}
            </span>
            <ChevronRight
              className={cx(
                "text-ink-soft transition-transform duration-[var(--dur-hover)] ease-[var(--ease-out)]",
                open && "rotate-90",
              )}
            />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-line border-t border-dashed px-[18px] py-4">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

/** The eyebrow that labels a run of cards, e.g. above the bento itself. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Text
      variant="eyebrow"
      as="div"
      className="mb-2.5 [&_span]:normal-case [&_span]:text-[13px] [&_span]:tracking-normal [&_span]:text-ink-soft"
    >
      {children}
    </Text>
  );
}
