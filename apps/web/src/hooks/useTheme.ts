import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "ipspeil-theme";

function readStored(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === "dark" || saved === "light" ? saved : null;
  } catch {
    return null;
  }
}

// Resolves the theme to apply on first paint: an explicit saved choice wins,
// otherwise fall back to the OS preference.
export function initialTheme(): Theme {
  return readStored() ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme) || initialTheme(),
  );

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // localStorage may be unavailable (private mode) — non-fatal.
      }
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}
