import { type ReactNode, useState } from "react";
import { cx } from "../lib/cx.ts";

// The ± sign: a horizontal bar always shown (accent when open) and a vertical bar
// that collapses when open, matching the old .rev-sign pseudo-elements.
function PlusMinus({ open }: { open: boolean }) {
  return (
    <span className="relative ml-auto size-[15px] shrink-0">
      <span
        className={cx(
          "absolute inset-x-0 top-[7px] h-[1.6px] rounded-[2px] transition-colors",
          open ? "bg-accent" : "bg-ink-soft",
        )}
      />
      <span
        className={cx(
          "absolute inset-y-0 left-[7px] w-[1.6px] rounded-[2px] bg-ink-soft transition-transform duration-[250ms] motion-reduce:transition-none",
          open && "scale-y-0",
        )}
      />
    </span>
  );
}

// A numbered, expandable "Deeper look" section. The open/close slide uses the
// grid-template-rows 0fr→1fr technique so height animates without a fixed value.
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
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b border-line-soft first-of-type:border-t first-of-type:border-t-line">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[44px] w-full items-center gap-[14px] py-[15px] text-left transition-[padding] duration-150 [@media(hover:hover)]:hover:pl-1.5"
      >
        <span
          className={cx(
            "shrink-0 font-mono text-[11px] transition-colors",
            open ? "text-accent" : "text-ink-faint",
          )}
        >
          {num}
        </span>
        <span className="flex min-w-0 flex-col gap-[3px]">
          <b className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink max-[560px]:text-[15px]">
            {title}
          </b>
          <em className="text-[12.5px] text-ink-faint not-italic max-[560px]:text-[12px]">
            {subtitle}
          </em>
        </span>
        {badge ? (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-[color-mix(in_oklab,var(--warn)_40%,transparent)] px-2 py-0.5 font-mono text-[10px] text-warn">
            {badge}
          </span>
        ) : null}
        <PlusMinus open={open} />
      </button>
      <div
        className={cx(
          "grid transition-[grid-template-rows] duration-[340ms] ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        {/* min-h-0 + overflow-hidden lets the 0fr track fully collapse. */}
        <div className="min-h-0 overflow-hidden">
          <div className="px-0.5 [&>*:first-child]:mt-0.5 [&>*:last-child]:mb-[22px]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
