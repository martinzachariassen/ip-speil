import { SectionHeading } from "@martinzachariassen/design";
import type { ReactNode } from "react";
import { cx } from "../lib/cx.ts";

/**
 * One section of the sheet: a ruled heading and its rows, sitting straight on
 * the page.
 *
 * There is no card here on purpose. Ten boxed panels turn a diagnostic page into
 * a dashboard, where every reading looks equally important and the borders do
 * nothing but repeat; a heading whose rule measures the column does the same
 * structural job for one hairline.
 *
 * Sections that fold aren't built from this — see `Readouts`, where the three
 * long reference readouts sit together in one `Accordion` rather than as three
 * separately-collapsing headings scattered down the page.
 */
export function Section({
  title,
  children,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("mb-9", className)}>
      <SectionHeading as="h2" className="mb-3">
        {title}
      </SectionHeading>
      {children}
    </section>
  );
}
