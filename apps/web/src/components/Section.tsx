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
 * `break-inside-avoid` keeps a section whole when the sheet flows into two
 * columns. It's a hint, not a guarantee — a section taller than the column will
 * still split, which is why the long readouts run full width instead.
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
    <section className={cx("mb-9 break-inside-avoid", className)}>
      <SectionHeading as="h2" className="mb-3">
        {title}
      </SectionHeading>
      {children}
    </section>
  );
}
