import {
  GlitchText,
  type GlitchTextHandle,
  MarginNote,
  Text,
  ToggleGroup,
  ToggleGroupItem,
  useCopyToClipboard,
} from "@martinzachariassen/design";
import { type CSSProperties, type ReactNode, useRef } from "react";
import type { Scan } from "../hooks/useScan.ts";
import { cx } from "../lib/cx.ts";
import { isSuccessfulLookup } from "../lib/format.ts";
import { Skel } from "./primitives.tsx";

export type Family = "v4" | "v6";

interface HeroProps {
  scan: Scan | null;
  loading: boolean;
  family: Family;
  onFamilyChange: (family: Family) => void;
  /** Announced politely when the address reaches the clipboard. */
  onAnnounce: (message: string) => void;
  /** The page's conclusion, set opposite the note in the annotation row. */
  verdict: ReactNode;
}

/**
 * The address, at the only display size on the page, and the whole thing is the
 * copy button.
 *
 * Two details are deliberate. The button is **inline-block, not full width**: a
 * click target has to look like the thing it copies, and a block that runs to
 * the edge of the screen invites clicks on empty paper that then silently copy
 * something. And the affordance rides on the **rule**, not on a line of help
 * text — the word "copy" fades in at the end of the rule on hover or focus and
 * turns into "copied", so the hint costs nothing when it isn't wanted and the
 * hand-written note underneath is free to say something worth reading.
 *
 * Copying fires one glitch burst: feedback, not atmosphere.
 */
export function Hero({
  scan,
  loading,
  family,
  onFamilyChange,
  onAnnounce,
  verdict,
}: HeroProps) {
  const glitch = useRef<GlitchTextHandle>(null);
  const { copied, copy } = useCopyToClipboard(2600);

  const d = scan?.data ?? null;
  const hasLookup = d ? isSuccessfulLookup(d) : false;
  const v4 = scan?.exits.v4 ?? (hasLookup && !d?.query?.includes(":") ? (d?.query ?? null) : null);
  const v6 = scan?.exits.v6 ?? null;
  const shown = family === "v6" ? v6 : v4;
  const label = family === "v6" ? "IPv6" : "IPv4";

  async function copyIp() {
    if (!shown) return;
    if (await copy(shown)) {
      glitch.current?.burst();
      onAnnounce(`${label} address ${shown} copied to clipboard`);
    }
  }

  return (
    <section className="pt-9 pb-2 lg:pt-14" aria-label="Your public IP address">
      {/* The page's only h1. The subject of this page is the address, not the
          brand — the mark in the header is a link home, not a heading, and a
          document whose outline starts at h2 has no top. */}
      <Text variant="eyebrow" as="h1" className="tracking-[0.18em]">
        Your public IP address
      </Text>

      <button
        type="button"
        onClick={copyIp}
        disabled={!shown}
        aria-label={
          shown ? `Copy your ${label} address, ${shown}` : "No address to copy — try refreshing"
        }
        className="group mt-1.5 inline-block max-w-full cursor-copy text-left disabled:cursor-not-allowed"
      >
        {/* aria-hidden because the button's own label already speaks the
            address; GlitchText's sr-only copy would otherwise say it twice. */}
        <span
          aria-hidden="true"
          className="block break-all font-bold font-mono text-[clamp(2.3rem,8.4vw,5.4rem)] text-accent-deep leading-[1.02] tracking-[-0.045em] transition-opacity duration-[var(--dur-hover)] ease-[var(--ease-glide)] group-hover:opacity-[0.82]"
        >
          {loading ? (
            <Skel className="h-[0.8em] w-[min(9ch,72vw)]" />
          ) : shown ? (
            <GlitchText text={shown} trigger="manual" burstRef={glitch} />
          ) : (
            "Unavailable"
          )}
        </span>

        <span className="mt-4 flex items-center gap-3.5">
          <span className="h-0.5 flex-1 bg-accent opacity-85" />
          <span
            aria-hidden="true"
            className={cx(
              "font-mono text-[11px] uppercase tracking-[0.16em] transition-opacity duration-[var(--dur-hover)] ease-[var(--ease-glide)]",
              copied
                ? "text-success-deep opacity-100"
                : "text-ink-soft opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100",
            )}
          >
            {copied ? "copied" : "copy"}
          </span>
        </span>
      </button>

      {/* The annotation row: the note on the left says what the address *is*,
          the verdict on the right says whether it's a problem. They read as a
          pair, and together they fill the half-page of empty paper the address
          used to leave beside it. */}
      <div className="mt-2 lg:flex lg:items-start lg:justify-between lg:gap-16">
        <div className="min-w-0">
          {/* Left-aligned under the address, with the arrowhead reaching back up
              into it. Centring the note (as the sketch did) leaves it floating
              between two columns of nothing and breaks the line the eye follows
              down the page. */}
          <MarginNote
            arrow="up-left"
            className="items-start text-left"
            // Wider than the system's 24ch default: this note sits in the main
            // column under the address, not in a true margin.
            style={{ "--mlz-note-measure": "46ch" } as CSSProperties}
          >
            this is the address every site you visit sees — including the ones you never asked to
            be seen by
          </MarginNote>

          {v6 && v4 ? (
            <ToggleGroup
              type="single"
              value={family}
              onValueChange={(next) => next && onFamilyChange(next as Family)}
              aria-label="Which address family to show"
              className="mt-6 justify-start gap-1.5"
            >
              <ToggleGroupItem value="v4" variant="outline" size="sm">
                IPv4
              </ToggleGroupItem>
              <ToggleGroupItem value="v6" variant="outline" size="sm">
                IPv6
              </ToggleGroupItem>
            </ToggleGroup>
          ) : null}
        </div>

        <div className="mt-9 lg:mt-1.5 lg:w-[34ch] lg:shrink-0">{verdict}</div>
      </div>
    </section>
  );
}
