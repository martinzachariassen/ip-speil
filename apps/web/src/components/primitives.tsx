import {
  Button as DsButton,
  type ButtonProps as DsButtonProps,
  Callout,
  DataList,
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

// A status dot — thin wrapper over the design system's <StatusDot>. Pass `label`
// wherever the dot is the *only* carrier of state (e.g. the Exposure ledger) so
// the severity is announced to assistive tech instead of relying on colour alone
// — StatusDot exposes it via role="img"; without a label it stays aria-hidden.
export function Dot({
  severity,
  pulse,
  label,
  className,
}: {
  severity: Severity;
  pulse?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <StatusDot
      variant={severityVariant(severity)}
      pulse={pulse}
      label={label}
      className={className}
    />
  );
}

// A word for each severity, for the sr-only status carried alongside a Dot.
export const SEVERITY_LABEL: Record<Severity, string> = {
  ok: "OK",
  warn: "Warning",
  bad: "Alert",
  off: "Not applicable",
};

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

// A key/value row with a dashed separator — the design system's <DataRow>. It
// renders a <dt>/<dd> pair, so a run of KVs must sit inside a <KVList> (a real
// <dl>) for the description-list relationship to be programmatically conveyed.
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

// The <dl> wrapper for a contiguous run of <KV> rows. Gives the dt/dd pairs a
// valid, programmatically-determinable description-list container (WCAG 1.3.1).
export function KVList({ children }: { children: ReactNode }) {
  return <DataList>{children}</DataList>;
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
  // "Muted" carries real content (values, short notes), so it uses the soft ink
  // rather than the faintest tone — readable while still visibly de-emphasised.
  return <Text className="text-ink-soft">{children}</Text>;
}

// Uppercase mono sub-heading inside a reveal body (the eyebrow role).
export function SubLabel({ children, tip }: { children: ReactNode; tip?: GlossaryKey }) {
  return (
    <Text variant="eyebrow" as="div" className="mt-[18px] mb-[6px] text-ink-soft">
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
  // Longer prose reads better in Space Grotesk than the mono default. Uses the
  // soft ink (not the faintest) since it carries explanatory copy and warnings.
  return (
    <Text as="p" className="mb-[14px] font-grotesk text-[13px] leading-[1.55] text-ink-soft">
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
  // The design system's ghost variant clears the outline without a replacement,
  // so add an explicit focus-visible ring here to guarantee a visible keyboard
  // focus indicator across every ip-speil button (WCAG 2.4.7).
  return (
    <DsButton
      variant={dsVariant}
      size="sm"
      className={cx(
        "focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
        className,
      )}
      {...props}
    >
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
