import { Button, Container, CopyButton } from "@martinzachariassen/design";
import type { PageActions } from "./actions.ts";
import { cx } from "../lib/cx.ts";
import { Clipboard, Moon, Refresh, Save, Share, Sun } from "../lib/icons.tsx";

/**
 * The sticky bar: the mark, two jumps into the page, and the scan actions.
 *
 * The actions used to live in a left rail that owned a third of every wide
 * viewport. Up here they cost one row and give the page back its full width for
 * the thing people came for. On a phone they move to `MobileActions` — a bar you
 * can reach with a thumb — so this collapses to the mark and the theme switch.
 */
export function SiteHeader({ actions }: { actions: PageActions }) {
  const { loading, onRefresh, reportJson, shareUrl, onSnapshot, snapshotFlash, theme, onToggleTheme, announce } =
    actions;

  return (
    <header className="sticky top-0 z-20 border-line border-b bg-[color-mix(in_oklch,var(--background)_88%,transparent)] backdrop-blur-md">
      <Container size="xl" className="flex h-[52px] items-center gap-3.5">
        <span className="font-bold font-mono text-[15px] tracking-[-0.02em] text-ink">
          ip<span className="text-accent-deep">·</span>speil
        </span>
        <span className="font-mono text-[11px] text-ink-faint tracking-[0.14em] uppercase max-sm:hidden">
          your internet mirror
        </span>

        <nav aria-label="Scan actions" className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            aria-label="Run a fresh scan"
            className="max-lg:hidden"
          >
            <Refresh className={cx(loading && "animate-spin")} />
            <span>Refresh</span>
          </Button>

          <CopyButton
            variant="ghost"
            size="sm"
            value={reportJson ?? ""}
            disabled={!reportJson}
            label={
              <span className="inline-flex items-center gap-2">
                <Clipboard />
                Report
              </span>
            }
            copiedLabel="Report copied"
            onCopied={(ok) => ok && announce("Diagnostics report copied to clipboard")}
            aria-label="Copy the redacted diagnostics report to the clipboard"
            className="max-lg:hidden"
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={onSnapshot}
            disabled={!reportJson}
            aria-label="Save this scan locally to compare against later"
            className="max-lg:hidden"
          >
            <Save />
            <span>{snapshotFlash ?? "Snapshot"}</span>
          </Button>

          <CopyButton
            variant="ghost"
            size="sm"
            value={shareUrl ?? ""}
            disabled={!shareUrl}
            label={
              <span className="inline-flex items-center gap-2">
                <Share />
                Share
              </span>
            }
            copiedLabel="Link copied"
            onCopied={(ok) => ok && announce("Shareable link copied to clipboard")}
            aria-label="Copy a shareable link containing the redacted report"
            className="max-lg:hidden"
          />

          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleTheme}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            className="size-9"
          >
            {theme === "dark" ? <Sun /> : <Moon />}
          </Button>
        </nav>
      </Container>
    </header>
  );
}
