import { FindingList } from "@martinzachariassen/design";
import { cx } from "../../lib/cx.ts";
import { type DiffField, flattenReport, type SnapshotDiff } from "../../lib/diff.ts";
import { ArrowRight } from "../../lib/icons.tsx";
import type { Report } from "../../report.ts";
import { Button, Dot, Finding, KV, KVList, Mono, SEVERITY_LABEL } from "../primitives.tsx";

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// A changed field, rendered as old → new. Uses the design system's grid <DataRow>
// (via <KV>), so the snapshot diff shares one row system with "Connection
// details" — a fixed eyebrow-label column that collapses to one column when narrow.
function DiffRow({ label, before, after }: DiffField) {
  return (
    <KV k={label}>
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 break-words [&>*]:min-w-0">
        <span className="font-mono text-[14px] text-ink-faint line-through decoration-line-2">
          {before}
        </span>
        {/* sr-only phrasing gives the before→after pair a spoken relationship. */}
        <span className="sr-only"> changed to </span>
        <ArrowRight className="text-ink-faint" />
        <span className="font-mono text-[14px] font-medium text-ink">{after}</span>
      </span>
    </KV>
  );
}

// "Since your snapshot" — the field-by-field diff against a saved scan. Rendered
// as a plain section (dot-led summary + a border-t list) rather than a card, so
// it sits alongside the other sections instead of floating above them.
export function Diff({ diff, onClear }: { diff: SnapshotDiff; onClear: () => void }) {
  const changed = diff.changedCount > 0;
  const summary = changed
    ? diff.changedCount === 1
      ? "1 change"
      : `${diff.changedCount} changes`
    : "Nothing changed";
  const severity = changed ? "warn" : "ok";

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line-soft pb-3">
        <span className="flex items-center gap-2 text-[15px] font-medium text-ink">
          <Dot severity={severity} label={SEVERITY_LABEL[severity]} />
          {summary}
        </span>
        <span className="font-mono text-[12px] text-ink-faint">saved {when(diff.savedAt)}</span>
        <Button
          variant="ghost"
          onClick={onClear}
          className="ml-auto"
          aria-label="Clear the saved snapshot"
        >
          Clear
        </Button>
      </div>

      <KVList>
        {diff.fields.map((f) => (
          <DiffRow key={f.label} {...f} />
        ))}

        {/* Fingerprint is reported changed/unchanged only — the hash is never shown. */}
        <KV k="Browser fingerprint">
          <span
            className={cx(
              "font-mono text-[14px]",
              diff.fingerprintChanged ? "font-medium text-ink" : "text-ink-soft",
            )}
          >
            {diff.fingerprintChanged ? "changed" : "unchanged"}
          </span>
        </KV>
      </KVList>
    </div>
  );
}

// A read-only shared snapshot decoded from the URL fragment (#r=…).
export function Shared({ report }: { report: Report }) {
  const stamp = report.generatedAt ? ` Reported ${when(report.generatedAt)}.` : "";
  return (
    <>
      <FindingList className="mb-4">
        <Finding severity="off" title="Viewing a shared snapshot">
          This read-only summary was shared with you via a link and contains only redacted values.
          {stamp}
        </Finding>
      </FindingList>
      <KVList>
        {flattenReport(report)
          .filter((f) => f.value !== "—")
          .map((f) => (
            <KV key={f.label} k={f.label}>
              <Mono>{f.value}</Mono>
            </KV>
          ))}
      </KVList>
    </>
  );
}
