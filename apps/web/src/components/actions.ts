import type { ReactNode } from "react";

/**
 * The five things you can do to a scan, resolved once in `App` and handed to
 * both places that offer them — the header on a wide screen, the sticky bar on a
 * phone. Sharing the object is what keeps the two bars from drifting apart.
 *
 * The clipboard values are pre-rendered strings rather than callbacks because
 * the design system's `CopyButton` takes a value, not a producer: it owns the
 * write and the "Copied" flash, so the app only has to say *what*.
 */
export interface PageActions {
  loading: boolean;
  onRefresh: () => void;
  /** The redacted report as JSON, or null before the first scan lands. */
  reportJson: string | null;
  /** A self-contained link with the redacted report in the fragment. */
  shareUrl: string | null;
  onSnapshot: () => void;
  snapshotFlash: string | null;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  /** Route a message to the page's single polite live region. */
  announce: (message: string) => void;
}

export type ActionSlot = { key: string; node: ReactNode };
