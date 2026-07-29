import { flattenReport, type SnapshotDiff } from "../../lib/diff.ts";
import type { Report } from "../../report.ts";
import { Icon } from "@martinzachariassen/design";
import { KV, KVList, Mono, Muted, Note } from "../primitives.tsx";

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

// "Since your snapshot" — the field-by-field diff against a saved scan.
export function Diff({ diff }: { diff: SnapshotDiff }) {
  return (
    <>
      <Note
        severity={diff.changedCount ? "warn" : "ok"}
        title={
          diff.changedCount
            ? diff.changedCount === 1
              ? "1 change since your snapshot"
              : `${diff.changedCount} changes since your snapshot`
            : "Nothing changed since your snapshot"
        }
        desc={`Snapshot taken ${when(diff.savedAt)}.`}
      />
      <KVList>
        {diff.fields.map((f) => (
          <KV key={f.label} k={f.label}>
            <Muted>{f.before}</Muted>
            {/* sr-only phrasing gives the before→after pair a spoken relationship. */}
            <span className="sr-only"> changed to </span>
            <Icon
              name="arrow-right"
              size="xs"
              className="mx-1 inline-block align-[-2px] text-ink-faint"
            />
            <Mono>{f.after}</Mono>
          </KV>
        ))}
        {/* Fingerprint is reported changed/unchanged only — the hash is never shown. */}
        <KV k="Browser fingerprint">{diff.fingerprintChanged ? "changed" : "unchanged"}</KV>
      </KVList>
    </>
  );
}

// A read-only shared snapshot decoded from the URL fragment (#r=…).
export function Shared({ report }: { report: Report }) {
  const stamp = report.generatedAt ? ` Reported ${when(report.generatedAt)}.` : "";
  return (
    <>
      <Note
        severity="off"
        title="Viewing a shared snapshot"
        desc={`This read-only summary was shared with you via a link and contains only redacted values.${stamp}`}
      />
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
