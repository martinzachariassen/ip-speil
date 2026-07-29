import { AccordionContent, AccordionItem, AccordionTrigger, Badge } from "@martinzachariassen/design";
import type { ReactNode } from "react";

// One numbered "Deeper look" section. It renders a single <AccordionItem> and is
// meant to sit inside the shared <Accordion> in App.tsx — so all sections form one
// cohesive accordion: only one opens at a time, and Up/Down/Home/End roam between
// the triggers (the WAI-ARIA accordion keyboard pattern the design component ships).
// The open/close height animates via the component's grid-template-rows technique,
// and it provides the rotating chevron indicator for free.
export function Reveal({
  value,
  num,
  title,
  subtitle,
  badge,
  children,
}: {
  value: string;
  num: string;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <AccordionItem
      value={value}
      className="border-line-soft first-of-type:border-t first-of-type:border-t-line"
    >
      <AccordionTrigger className="min-h-[52px] gap-[14px] py-[15px] transition-[padding-left,color] [@media(hover:hover)]:hover:pl-1.5 [@media(hover:hover)]:hover:text-accent">
        <span className="shrink-0 font-mono text-[11px] text-ink-faint tabular-nums">{num}</span>
        <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
          <b className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink max-[560px]:text-[15px]">
            {title}
          </b>
          <em className="text-[13px] text-ink-soft not-italic max-[560px]:text-[12.5px]">
            {subtitle}
          </em>
        </span>
        {badge ? (
          <Badge variant="outline" className="shrink-0 normal-case tracking-[0.02em] text-warn">
            {badge}
          </Badge>
        ) : null}
      </AccordionTrigger>
      <AccordionContent className="px-0.5 pb-0 text-inherit [&>*:first-child]:mt-0.5 [&>*:last-child]:mb-[22px]">
        {children}
      </AccordionContent>
    </AccordionItem>
  );
}
