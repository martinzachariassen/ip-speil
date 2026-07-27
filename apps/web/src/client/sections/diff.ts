import { flattenReport, type SnapshotDiff } from "../lib/diff.ts";
import { byId, kv, note } from "../lib/dom.ts";
import { esc } from "../lib/format.ts";
import type { Report } from "../report.ts";

function when(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}

// The diff/shared field labels are stable English strings (locked by lib/diff.ts
// and its test).
function fieldLabel(label: string): string {
  return label;
}

export function renderDiff(diff: SnapshotDiff | null) {
  const sec = byId("diff-sec");
  const body = byId("diff-body");
  if (!diff) {
    sec.hidden = true;
    body.innerHTML = "";
    return;
  }
  sec.hidden = false;

  let html = note(
    diff.changedCount ? "warn" : "ok",
    diff.changedCount
      ? diff.changedCount === 1
        ? "1 change since your snapshot"
        : `${diff.changedCount} changes since your snapshot`
      : "Nothing changed since your snapshot",
    `Snapshot taken ${when(diff.savedAt)}.`,
  );

  for (const f of diff.fields) {
    html += kv(
      fieldLabel(f.label),
      `<span class="muted">${esc(f.before)}</span> → <span class="m">${esc(f.after)}</span>`,
    );
  }

  // Fingerprint is reported changed/unchanged only — the hash is never shown.
  html += kv("Browser fingerprint", diff.fingerprintChanged ? "changed" : "unchanged");

  body.innerHTML = html;
}

export function renderShared(report: Report | null) {
  const sec = byId("share-sec");
  const body = byId("share-body");
  if (!report) {
    sec.hidden = true;
    body.innerHTML = "";
    return;
  }
  sec.hidden = false;

  const stamp = report.generatedAt ? ` Reported ${when(report.generatedAt)}.` : "";
  let html = note(
    "off",
    "Viewing a shared snapshot",
    "This read-only summary was shared with you via a link and contains only redacted values." +
      stamp,
  );
  for (const f of flattenReport(report)) {
    if (f.value !== "—") html += kv(fieldLabel(f.label), `<span class="m">${esc(f.value)}</span>`);
  }
  body.innerHTML = html;
}
