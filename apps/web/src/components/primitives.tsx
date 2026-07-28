import {
  Button as DsButton,
  type ButtonProps as DsButtonProps,
  Callout,
  DataRow,
  Separator,
  Skeleton,
  StatusDot,
  type StatusDotProps,
  Text,
} from "@martinzachariassen/design";
import type { ReactNode } from "react";
import { cx } from "../lib/cx.ts";
import { type GlossaryKey, Tip } from "../lib/glossary.tsx";

// Compose a label with an optional inline info-tip that explains a jargon term.
function withTip(label: ReactNode, tip?: GlossaryKey) {
  if (!tip) return label;
  return (
    <span className="inline-flex items-center gap-1.5">
      {label}
      <Tip k={tip} />
    </span>
  );
}

// Severity drives the status colours used across the app. It maps onto the
// design system's semantic signal roles — so every colour comes from the system,
// while call sites keep passing the familiar ip-speil severity.
export type Severity = "ok" | "warn" | "bad" | "off";

type SignalVariant = NonNullable<StatusDotProps["variant"]>;

const SEVERITY_VARIANT: Record<Severity, SignalVariant> = {
  ok: "success",
  warn: "warning",
  bad: "destructive",
  off: "muted",
};

/** Map an ip-speil severity to the design system's signal variant. */
export function severityVariant(severity: Severity): SignalVariant {
  return SEVERITY_VARIANT[severity];
}

// A status dot — thin wrapper over the design system's <StatusDot>.
export function Dot({
  severity,
  pulse,
  className,
}: {
  severity: Severity;
  pulse?: boolean;
  className?: string;
}) {
  return <StatusDot variant={severityVariant(severity)} pulse={pulse} className={className} />;
}

// A titled note with a leading status dot and an optional description — the
// design system's <Callout>, kept under ip-speil's old name/props.
export function Note({
  severity,
  title,
  desc,
  tip,
}: {
  severity: Severity;
  title: ReactNode;
  desc?: ReactNode;
  tip?: GlossaryKey;
}) {
  return (
    <Callout
      variant={severityVariant(severity)}
      title={withTip(title, tip)}
      description={desc}
      className="mb-3"
    />
  );
}

// A key/value row with a dashed separator — the design system's <DataRow>.
export function KV({
  k,
  mono,
  tip,
  children,
}: {
  k: string;
  mono?: boolean;
  tip?: GlossaryKey;
  children: ReactNode;
}) {
  return (
    <DataRow label={withTip(k, tip)} mono={mono}>
      {children}
    </DataRow>
  );
}

// Small inline type roles, mapped onto the design system's <Text> primitive.
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Text variant="mono" className={className}>
      {children}
    </Text>
  );
}

export function MonoSm({ children }: { children: ReactNode }) {
  return (
    <Text variant="mono" className="text-[13px]">
      {children}
    </Text>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  // ip-speil's "muted" is the faintest ink; keep that tone over the Text role.
  return <Text className="text-ink-faint">{children}</Text>;
}

// Uppercase mono sub-heading inside a reveal body (the eyebrow role).
export function SubLabel({ children, tip }: { children: ReactNode; tip?: GlossaryKey }) {
  return (
    <Text variant="eyebrow" as="div" className="mt-[18px] mb-[6px] text-ink-faint">
      {tip ? (
        <span className="inline-flex items-center gap-1.5">
          {children}
          <Tip k={tip} />
        </span>
      ) : (
        children
      )}
    </Text>
  );
}

export function BodyIntro({ children }: { children: ReactNode }) {
  // Longer prose reads better in Space Grotesk than the mono default.
  return (
    <Text as="p" className="mb-[14px] font-grotesk text-[13px] leading-[1.55] text-ink-faint">
      {children}
    </Text>
  );
}

// A hairline rule — the design system's <Separator>.
export function Divider() {
  return <Separator className="my-4" />;
}

// Button — the design system's <Button>. ip-speil's "ghost"/"mini" map to the
// system's ghost variant / small size; the default is the signature outline.
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
  const dsVariant: DsButtonProps["variant"] = variant === "ghost" ? "ghost" : "default";
  return (
    <DsButton variant={dsVariant} size="sm" className={className} {...props}>
      {children}
    </DsButton>
  );
}

// Shimmer skeleton placeholder — the design system's <Skeleton>. Kept
// inline-block + align-middle so it drops into inline text like the old Skel.
export function Skel({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <Skeleton className={cx("inline-block align-middle", className)} style={style} />;
}
