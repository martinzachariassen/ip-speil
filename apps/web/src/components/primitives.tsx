import {
  Badge,
  Button as DsButton,
  type ButtonProps as DsButtonProps,
  type DataLayout,
  DataList,
  DataRow,
  FindingItem,
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

// One check and how it came back — the design system's <FindingItem>, taking
// ip-speil's severity and an optional glossary tip on the title. It must sit
// inside a <FindingList>, which is what draws the rule the findings hang on.
//
// This replaced a local <Callout> wrapper. A callout is a block that demands
// attention: right once, wrong the eight times in a row this page needs, and
// floating free of the rule that every other row on the sheet is measured
// against. The one statement still allowed to stand on its own is the verdict.
export function Finding({
  severity,
  title,
  tip,
  children,
}: {
  severity: Severity;
  title: ReactNode;
  tip?: GlossaryKey;
  children?: ReactNode;
}) {
  return (
    <FindingItem
      variant={severityVariant(severity)}
      statusLabel={SEVERITY_LABEL[severity]}
      title={withTip(title, tip)}
    >
      {children}
    </FindingItem>
  );
}

// A small inline chip/token — the design system's <Badge>, tuned for ip-speil's
// data-bearing tags (IP addresses, trust labels): a readable 12px mono in normal
// case that wraps long values, rather than the Badge's default uppercase micro-
// label. `tone` maps onto the app's status cues without ever relying on colour
// alone (the surrounding copy always names the state).
export type ChipTone = "default" | "alert" | "local" | "muted";

const CHIP_TONE: Record<ChipTone, string> = {
  default: "",
  // `-deep`, not the fill: a chromatic fill measures ~1.8:1 on paper, so using
  // it as text is the one colour bug the design system's ladder exists to stop.
  alert: "border-destructive text-destructive-deep",
  local: "border-dashed",
  muted: "text-ink-soft",
};

export function Chip({
  tone = "default",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: ChipTone }) {
  return (
    <Badge
      variant="outline"
      className={cx(
        "gap-1.5 whitespace-normal break-words px-2 py-1 text-[13px] tracking-normal normal-case",
        CHIP_TONE[tone],
        className,
      )}
      {...props}
    >
      {children}
    </Badge>
  );
}

// A key/value row — the design system's <DataRow>. It renders a <dt>/<dd> pair,
// so a run of KVs must sit inside a <KVList> (a real <dl>) for the description-
// list relationship to be programmatically conveyed. The layout is inherited
// from the parent <KVList>, but a single row may override it.
export function KV({
  k,
  mono,
  tip,
  layout,
  children,
}: {
  k: string;
  mono?: boolean;
  tip?: GlossaryKey;
  layout?: DataLayout;
  children: ReactNode;
}) {
  return (
    <DataRow label={withTip(k, tip)} mono={mono} layout={layout}>
      {children}
    </DataRow>
  );
}

// The <dl> wrapper for a contiguous run of <KV> rows. Gives the dt/dd pairs a
// valid, programmatically-determinable description-list container (WCAG 1.3.1).
//
// `ledger` is the page's row system: the design system's grid layout plus the
// ruled margin. The rules are what let a dozen fact lists sit straight on the
// page without a card around each one — they mark the block and measure the
// column, which is the job the card borders used to do.
export function KVList({
  layout = "ledger",
  className,
  children,
}: {
  layout?: DataLayout;
  className?: string;
  children: ReactNode;
}) {
  return (
    <DataList layout={layout} className={className}>
      {children}
    </DataList>
  );
}

// Two ruled lists side by side from `lg` — a pair of <KVList>s or a pair of
// <FindingList>s. A twenty-row list set full width leaves three-quarters of the
// line empty and makes the reader travel the height of the screen twice; split
// down the middle it reads in one pass.
//
// Two lists, not one in CSS columns: each keeps its own rule down the left, and
// a column break can't land between a <dt> and its <dd>.
export function Columns({ children }: { children: ReactNode }) {
  return <div className="grid gap-x-12 gap-y-0 lg:grid-cols-2">{children}</div>;
}

/** Split a run of rows down the middle, so the two columns end level. */
export function halves<T>(rows: T[]): [T[], T[]] {
  const cut = Math.ceil(rows.length / 2);
  return [rows.slice(0, cut), rows.slice(cut)];
}

// A closing aside — smaller than body copy, hanging off nothing. For the line
// that reassures rather than reports (what we sent upstream, what we didn't
// keep); it belongs on the page but not at the weight of a reading.
export function Footnote({ children }: { children: ReactNode }) {
  return <p className="mt-3.5 mb-0 max-w-[68ch] text-[12px] text-ink-faint leading-relaxed">{children}</p>;
}

// A whole section with nothing to show — one muted line hanging off the same
// rule the fact lists use, rather than an empty box. The design system's
// <EmptyState> is the right thing when the emptiness is the subject and there's
// an action to offer; here it is a footnote about an upstream that didn't answer.
export function Absent({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 border-line border-l py-1.5 pl-3.5 text-[13px] text-ink-faint">{children}</p>
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
    <Text variant="mono" className="text-[14px]">
      {children}
    </Text>
  );
}

export function Muted({ children }: { children: ReactNode }) {
  // "Muted" carries real content (values, short notes), so it uses the soft ink
  // rather than the faintest tone — readable while still visibly de-emphasised.
  return <Text className="text-ink-soft">{children}</Text>;
}

// Uppercase mono sub-heading inside a section body (the eyebrow role). The
// section's own heading is the design system's <SectionHeading>; this is the
// level below it, for a block within one section.
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
    <Text as="p" className="mb-[14px] font-grotesk text-[14px] leading-[1.55] text-ink-soft">
      {children}
    </Text>
  );
}

// A hairline rule — the design system's <Separator>.
export function Divider() {
  return <Separator className="my-4" />;
}

// Button — the design system's <Button>. ip-speil's "ghost" maps to the system's
// ghost variant; the default is the signature outline.
export function Button({
  variant,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "ghost";
}) {
  const dsVariant: DsButtonProps["variant"] = variant === "ghost" ? "ghost" : "default";
  // The design system's ghost variant clears the outline without a replacement,
  // so add an explicit focus-visible ring here to guarantee a visible keyboard
  // focus indicator (WCAG 2.4.7). `ring-ring` — not `ring-accent`: the plain
  // accent is a fill and measures 1.83:1 on paper, under the 3:1 a focus
  // indicator has to clear. `--ring` sits on the `-deep` rung for exactly this.
  return (
    <DsButton
      variant={dsVariant}
      size="sm"
      className={cx(
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-paper",
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
