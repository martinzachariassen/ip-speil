import type { ExposureItem } from "../../lib/exposure.ts";
import { cx } from "../../lib/cx.ts";
import { Tip } from "../../lib/glossary.tsx";
import { Dot, SEVERITY_LABEL } from "../primitives.tsx";

const DETAIL_COLOR: Record<ExposureItem["severity"], string> = {
  ok: "text-ink-soft",
  off: "text-ink-soft",
  warn: "text-warn",
  bad: "text-destructive",
};

// The "What sites can see" ledger — a responsive two-column grid of status rows.
// It's a real list, and each row's severity rides on the dot's accessible label
// (not colour alone), so the ok/warn/alert state is announced to screen readers.
export function Exposure({ items }: { items: ExposureItem[] }) {
  return (
    <ul className="grid list-none grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-x-7 border-t border-line pl-0">
      {items.map((i) => (
        <li
          key={i.label}
          className="flex items-center gap-2.5 border-b border-line-soft py-[11px] text-[13.5px]"
        >
          <Dot severity={i.severity} label={SEVERITY_LABEL[i.severity]} />
          <span className="font-medium text-ink">{i.label}</span>
          {i.tip ? <Tip k={i.tip} /> : null}
          {i.detail ? (
            <span
              className={cx(
                "ml-auto break-words text-right font-mono text-[11.5px]",
                DETAIL_COLOR[i.severity],
              )}
            >
              {i.detail}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
