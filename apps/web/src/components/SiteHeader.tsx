import { Button, Container, CopyButton, ThemeToggle } from "@martinzachariassen/design";
import type { PageActions } from "./actions.ts";

/**
 * The sticky bar: the mark, the scan actions, and the theme switch.
 *
 * The actions are set in the mono eyebrow voice rather than as labelled icon
 * buttons — up here they're a menu of things you can do to the page, not
 * controls attached to any one reading, and the quieter type keeps them from
 * competing with the address below.
 *
 * Below `lg` they move to `MobileActions`, a bar you can reach with a thumb; the
 * two sets are `max-lg:hidden` / `lg:hidden`, so exactly one is ever in the
 * accessibility tree and no control is announced twice.
 */
export function SiteHeader({ actions }: { actions: PageActions }) {
  const { loading, onRefresh, reportJson, shareUrl, onSnapshot, snapshotFlash, announce } = actions;

  // The eyebrow voice, shared by the four action buttons.
  const ghost =
    "max-lg:hidden font-mono text-[11px] uppercase tracking-[0.14em] text-ink-soft hover:text-ink";

  return (
    // `bg-paper/90`, not a hand-written `color-mix(… in oklch …, transparent)`:
    // Chrome doesn't treat transparent's hue as powerless there, so the mix
    // drifts the paper a visible pink. Tailwind's alpha modifier mixes in oklab,
    // which stays neutral.
    <header className="sticky top-0 z-20 border-line border-b bg-paper/90 backdrop-blur-md">
      <Container size="xl" className="flex h-[54px] items-center gap-4">
        <span className="font-bold font-mono text-[15px] text-ink tracking-[-0.02em]">
          ip<span className="text-accent-deep">·</span>speil
        </span>
        <span className="font-mono text-[10.5px] text-ink-faint uppercase tracking-[0.18em] max-sm:hidden">
          your internet mirror
        </span>

        <nav aria-label="Scan actions" className="ml-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            aria-label="Run a fresh scan"
            className={ghost}
          >
            {loading ? "Scanning…" : "Refresh"}
          </Button>

          <CopyButton
            variant="ghost"
            size="sm"
            value={reportJson ?? ""}
            disabled={!reportJson}
            label="Report"
            copiedLabel="Copied"
            onCopied={(ok) => ok && announce("Diagnostics report copied to clipboard")}
            aria-label="Copy the redacted diagnostics report to the clipboard"
            className={ghost}
          />

          <Button
            variant="ghost"
            size="sm"
            onClick={onSnapshot}
            disabled={!reportJson}
            aria-label="Save this scan locally to compare against later"
            className={ghost}
          >
            {snapshotFlash ?? "Snapshot"}
          </Button>

          <CopyButton
            variant="ghost"
            size="sm"
            value={shareUrl ?? ""}
            disabled={!shareUrl}
            label="Share"
            copiedLabel="Copied"
            onCopied={(ok) => ok && announce("Shareable link copied to clipboard")}
            aria-label="Copy a shareable link containing the redacted report"
            className={ghost}
          />

          {/* Light / system / dark, straight from the design system — System is
              the one most people want and the only one that follows the OS at
              dusk, so it stays. */}
          <ThemeToggle iconOnly className="ml-2" />
        </nav>
      </Container>
    </header>
  );
}
