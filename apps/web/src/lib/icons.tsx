/**
 * The seven glyphs this app draws, as inline SVG.
 *
 * The design system removed its `<Icon>` component in v0.4 ("no icon library,
 * deliberately") and tells consumers to bring their own. Rather than add
 * `lucide-react` to an app whose whole point is a small runtime — three
 * dependencies, no trackers, no persistence — the handful of paths we actually
 * use live here. They're the Lucide outlines, drawn on Lucide's 24×24 grid with
 * its stroke settings, so they sit with the rest of the system.
 *
 * Every icon is decorative: `aria-hidden`, sized in `em` so it scales with the
 * text beside it, and stroked in `currentColor` so it inherits whatever the
 * label is coloured. If a glyph is ever the *only* thing in a control, give the
 * control an `aria-label` — none of these say anything on their own.
 */

import { cx } from "./cx";

export type IconProps = {
  className?: string;
};

function Glyph({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={cx("size-[1em] flex-none", className)}
    >
      {children}
    </svg>
  );
}

export function Clipboard({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </Glyph>
  );
}

export function Save({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7" />
      <path d="M7 3v4a1 1 0 0 0 1 1h7" />
    </Glyph>
  );
}

export function Share({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </Glyph>
  );
}

export function Refresh({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </Glyph>
  );
}

export function Warning({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3" />
      <path d="M12 9v4M12 17h.01" />
    </Glyph>
  );
}

export function ArrowLeft({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="m12 19-7-7 7-7M19 12H5" />
    </Glyph>
  );
}

export function ArrowRight({ className }: IconProps) {
  return (
    <Glyph className={className}>
      <path d="M5 12h14M12 5l7 7-7 7" />
    </Glyph>
  );
}
