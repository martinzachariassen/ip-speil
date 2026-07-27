import type { ReactNode } from "react";
import { cx } from "../lib/cx.ts";

// Severity drives the paper-aesthetic status colours used across the app.
export type Severity = "ok" | "warn" | "bad" | "off";

const DOT_COLOR: Record<Severity, string> = {
  ok: "text-ok",
  warn: "text-warn",
  bad: "text-accent",
  off: "text-ink-faint",
};

// A status dot. `bg-current` + a text colour keeps the fill and the pulse ring
// (which uses currentColor) in sync.
export function Dot({
  severity,
  pulse,
  className,
}: {
  severity: Severity;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-block size-2 shrink-0 rounded-full bg-current",
        DOT_COLOR[severity],
        pulse && "animate-pulse-dot",
        className,
      )}
    />
  );
}

// A titled note with a leading status dot and an optional description.
export function Note({
  severity,
  title,
  desc,
}: {
  severity: Severity;
  title: ReactNode;
  desc?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start gap-[9px] text-[13.5px] leading-[1.5] text-ink-soft">
      <Dot severity={severity} className="mt-[5px]" />
      <span>
        <b className="font-semibold text-ink">{title}</b>
        {desc ? (
          <small className="mt-0.5 block text-[12.5px] leading-[1.5] text-ink-faint">{desc}</small>
        ) : null}
      </span>
    </div>
  );
}

// A key/value row with a dashed separator. `mono` renders the value monospaced.
export function KV({
  k,
  mono,
  children,
}: {
  k: string;
  mono?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-5 border-b border-dashed border-line py-2 last:border-b-0 max-[560px]:flex-wrap max-[560px]:gap-x-[14px] max-[560px]:gap-y-1">
      <span className="shrink-0 text-[13.5px] text-ink-soft max-[560px]:flex-auto">{k}</span>
      <span
        className={cx(
          "max-w-[64%] break-words text-right text-[13px] text-ink max-[560px]:max-w-full max-[560px]:flex-[1_1_100%] max-[560px]:text-left",
          mono && "font-mono text-[12.5px]",
        )}
      >
        {children}
      </span>
    </div>
  );
}

// Small monospaced / muted inline spans mirroring the old .m / .sm / .muted.
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cx("font-mono", className)}>{children}</span>;
}

export function MonoSm({ children }: { children: ReactNode }) {
  return <span className="font-mono text-[13px]">{children}</span>;
}

export function Muted({ children }: { children: ReactNode }) {
  return <span className="text-ink-faint">{children}</span>;
}

// Uppercase mono sub-heading inside a reveal body.
export function SubLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-[18px] mb-[6px] font-mono text-[10px] tracking-[0.12em] text-ink-faint uppercase">
      {children}
    </div>
  );
}

export function BodyIntro({ children }: { children: ReactNode }) {
  return <p className="mb-[14px] text-[13px] leading-[1.55] text-ink-faint">{children}</p>;
}

export function Divider() {
  return <div className="my-4 h-px bg-line" />;
}

// Paper-aesthetic button. `ghost` = dashed + muted; `mini` = compact.
export function Button({
  variant,
  mini,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ghost";
  mini?: boolean;
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex items-center justify-center gap-[7px] rounded-lg border border-line-2 font-mono tracking-[0.01em] text-ink transition-[color,background,border-color] duration-150",
        "hover:border-ink hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)]",
        "focus-visible:outline-offset-4",
        variant === "ghost" && "border-dashed text-ink-soft",
        mini
          ? "min-h-0 rounded-[7px] px-2.5 py-[7px] text-[10px]"
          : "min-h-9 px-[13px] py-2 text-[11.5px]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

// Shimmer skeleton placeholder. Width/height come from the caller; the gradient
// + animation are self-contained so utility ordering can't override them.
export function Skel({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cx(
        "inline-block animate-shimmer rounded-md align-middle",
        "bg-[linear-gradient(90deg,var(--skel-a)_25%,var(--skel-b)_50%,var(--skel-a)_75%)] bg-[length:720px_100%]",
        className,
      )}
      style={style}
    />
  );
}
