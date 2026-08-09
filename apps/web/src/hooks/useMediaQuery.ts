import { useEffect, useState } from "react";

/**
 * Subscribe to a media query. Used for the one decision the CSS can't make on
 * its own: whether the bento cards start open (desktop) or closed (phone), which
 * is React state rather than a style.
 *
 * Reads synchronously on first render so there's no flash of the wrong state —
 * this app is client-only, so there's no server render to disagree with.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    setMatches(list.matches);
    list.addEventListener("change", onChange);
    return () => list.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
