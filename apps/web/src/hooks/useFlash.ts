import { useCallback, useEffect, useRef, useState } from "react";

// Transient button feedback: call flash("Copied") to override the label for a
// beat, then it reverts. Cleans up its timer on unmount. (Call sites pair the
// flash text with a check icon — no glyph baked into the string.)
export function useFlash(resetMs = 1600): [string | null, (text: string) => void] {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback(
    (value: string) => {
      if (timer.current) clearTimeout(timer.current);
      setText(value);
      timer.current = setTimeout(() => setText(null), resetMs);
    },
    [resetMs],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  return [text, flash];
}
