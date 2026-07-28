import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
} from "@martinzachariassen/design";
import type { ReactNode } from "react";

// A numbered, expandable "Deeper look" section, built on the design system's
// <Accordion>. Each Reveal is its own single/collapsible accordion so it keeps
// ip-speil's independent open/close behaviour; the open/close height animates via
// the design component's grid-template-rows technique and it ships the rotating
// chevron indicator + WAI-ARIA keyboard handling for free.
export function Reveal({
  num,
  title,
  subtitle,
  badge,
  children,
}: {
  num: string;
  title: string;
  subtitle: string;
  badge?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Accordion
      type="single"
      collapsible
      className="border-b border-line-soft first-of-type:border-t first-of-type:border-t-line"
    >
      <AccordionItem value="section" className="border-b-0">
        <AccordionTrigger className="min-h-[44px] gap-[14px] py-[15px] [@media(hover:hover)]:hover:pl-1.5">
          <span className="shrink-0 font-mono text-[11px] text-ink-faint">{num}</span>
          <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <b className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink max-[560px]:text-[15px]">
              {title}
            </b>
            <em className="text-[12.5px] text-ink-faint not-italic max-[560px]:text-[12px]">
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
    </Accordion>
  );
}
