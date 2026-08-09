import { Button, CopyButton } from "@martinzachariassen/design";
import { cx } from "../lib/cx.ts";
import { Clipboard, Refresh, Save, Share } from "../lib/icons.tsx";
import type { PageActions } from "./actions.ts";

/**
 * The sticky bar on phones, where the header's actions can't sit.
 *
 * Icon-only, deliberately: four labelled buttons don't fit across a 390px screen
 * — the fourth gets clipped off the edge, which is worse than a glyph. Each one
 * carries an `aria-label` and a `title`, so the name is there for a screen
 * reader and for anyone who hovers, and the targets end up bigger for a thumb
 * rather than smaller. Padded past the home indicator with
 * `env(safe-area-inset-bottom)`.
 *
 * It's `lg:hidden` and the header's copies are `max-lg:hidden`, so exactly one
 * set is ever in the accessibility tree — the same control never appears twice
 * to a screen reader.
 */
export function MobileActions({ actions }: { actions: PageActions }) {
  const { loading, onRefresh, reportJson, shareUrl, onSnapshot, announce } = actions;

  return (
    <div
      // bg-paper/92 rather than a hand-written oklch mix with `transparent` —
      // see SiteHeader: that mix drifts the paper pink in Chrome.
      className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-line border-t bg-paper/92 px-4 pt-2.5 pb-[max(10px,env(safe-area-inset-bottom))] backdrop-blur-md lg:hidden"
      role="group"
      aria-label="Scan actions"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={onRefresh}
        aria-label="Run a fresh scan"
        title="Refresh"
        className="h-12 flex-1"
      >
        <Refresh className={cx(loading && "animate-spin")} />
      </Button>

      <CopyButton
        variant="ghost"
        size="icon"
        value={reportJson ?? ""}
        disabled={!reportJson}
        label={<Clipboard />}
        copiedLabel={<span className="sr-only">Report copied</span>}
        onCopied={(ok) => ok && announce("Diagnostics report copied to clipboard")}
        aria-label="Copy the redacted diagnostics report to the clipboard"
        title="Copy report"
        className="h-12 flex-1"
      />

      <Button
        variant="ghost"
        size="icon"
        onClick={onSnapshot}
        disabled={!reportJson}
        aria-label="Save this scan locally to compare against later"
        title="Snapshot"
        className="h-12 flex-1"
      >
        <Save />
      </Button>

      <CopyButton
        variant="ghost"
        size="icon"
        value={shareUrl ?? ""}
        disabled={!shareUrl}
        label={<Share />}
        copiedLabel={<span className="sr-only">Link copied</span>}
        onCopied={(ok) => ok && announce("Shareable link copied to clipboard")}
        aria-label="Copy a shareable link containing the redacted report"
        title="Share"
        className="h-12 flex-1"
      />
    </div>
  );
}
