/** Where the chosen theme is remembered. Shared with the design system's `ThemeProvider`. */
export const THEME_STORAGE_KEY = "ipspeil-theme";

/**
 * Resolve the stored (or OS) theme and write it to `<html>` before React mounts,
 * so the page never paints in the wrong palette.
 *
 * The design system ships `themeInitScript()` for this, but that is an inline
 * `<script>` — refused outright under this site's `script-src 'self'`. Doing it
 * here costs the same round trip (the bundle is render-blocking anyway) and
 * needs no nonce, no hash and no build step.
 *
 * `"system"` and anything unrecognised fall through to the OS preference, which
 * is also what `ThemeProvider` resolves them to once it mounts.
 */
export function applyStoredTheme(): void {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // localStorage can throw in private mode — the OS preference still applies.
  }
  const resolved =
    stored === "light" || stored === "dark"
      ? stored
      : matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
  document.documentElement.dataset.theme = resolved;
}
