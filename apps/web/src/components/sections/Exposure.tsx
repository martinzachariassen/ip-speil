import type { ExposureItem } from "../../lib/exposure.ts";
import { cx } from "../../lib/cx.ts";
import { Dot } from "../primitives.tsx";

const DETAIL_COLOR: Record<ExposureItem["severity"], string> = {
  ok: "text-ink-faint",
  off: "text-ink-faint",
  warn: "text-warn",
  bad: "text-accent",
};

// The "What sites can see" ledger — a responsive two-column grid of status rows.
export function Exposure({ items }: { items: ExposureItem[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-x-7 border-t border-line">
      {items.map((i) => (
        <div
          key={i.label}
          className="flex items-center gap-2.5 border-b border-line-soft py-[11px] text-[13.5px]"
        >
          <Dot severity={i.severity} />
          <span className="font-medium text-ink">{i.label}</span>
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
        </div>
      ))}
    </div>
  );
}
