import {
  GlitchText,
  type GlitchTextHandle,
  MarginNote,
  Text,
  ToggleGroup,
  ToggleGroupItem,
  useCopyToClipboard,
} from "@martinzachariassen/design";
import { useRef } from "react";
import type { Scan } from "../hooks/useScan.ts";
import { cx } from "../lib/cx.ts";
import { formatPlace, isSuccessfulLookup } from "../lib/format.ts";
import { Skel } from "./primitives.tsx";

export type Family = "v4" | "v6";

interface HeroProps {
  scan: Scan | null;
  loading: boolean;
  family: Family;
  onFamilyChange: (family: Family) => void;
  /** Announced politely when the address reaches the clipboard. */
  onAnnounce: (message: string) => void;
}

/**
 * The whole identity block, and the whole thing is the copy button.
 *
 * The address is the one number anybody comes here for, so it gets the page's
 * only display-scale type and the only click target you can't miss. Copying it
 * fires a single glitch burst — feedback, not atmosphere — and swaps the
 * hand-written hint underneath for a confirmation.
 */
export function Hero({ scan, loading, family, onFamilyChange, onAnnounce }: HeroProps) {
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

  const place = d ? formatPlace(d) : "";
  const facts = [d?.isp || d?.org, d?.as, place].filter(Boolean) as string[];

  return (
    <section className="pt-9 pb-5 lg:pt-14" aria-label="Your public IP address">
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_210px]">
        <div className="min-w-0">
          <Text variant="eyebrow" as="p" className="tracking-[0.18em]">
            Your public IP address
          </Text>

          <button
            type="button"
            onClick={copyIp}
            disabled={!shown}
            aria-label={
              shown ? `Copy your ${label} address, ${shown}` : "No address to copy — try refreshing"
            }
            className="group mt-1 block w-full cursor-copy text-left disabled:cursor-not-allowed"
          >
            {/* aria-hidden because the button's own label already speaks the
                address; GlitchText's sr-only copy would otherwise say it twice. */}
            <span
              aria-hidden="true"
              className="block break-all font-bold font-mono text-[clamp(2.4rem,11vw,5.2rem)] leading-[1.02] tracking-[-0.045em] text-ink transition-colors duration-[var(--dur-hover)] ease-[var(--ease-glide)] group-hover:text-accent-deep group-focus-visible:text-accent-deep"
            >
              {loading ? (
                <Skel className="h-[0.8em] w-[min(9ch,80vw)]" />
              ) : shown ? (
                <GlitchText text={shown} trigger="manual" burstRef={glitch} />
              ) : (
                "Unavailable"
              )}
            </span>
            <span className="my-2.5 block h-0.5 bg-ink transition-colors duration-[var(--dur-hover)] ease-[var(--ease-glide)] group-hover:bg-accent group-focus-visible:bg-accent" />
            <Text
              as="span"
              className={cx(
                "block font-hand text-[16px]",
                copied ? "text-success-deep" : "text-ink-faint",
              )}
            >
              {copied ? "copied ✓" : shown ? "click anywhere here to copy" : "nothing to copy yet"}
            </Text>
          </button>

          {facts.length > 0 ? (
            <p className="mt-5 font-mono text-[13px] text-ink-soft">
              {facts.map((fact, i) => (
                <span key={fact}>
                  {i > 0 ? <span className="mx-2 text-line">/</span> : null}
                  <span className="text-ink">{fact}</span>
                </span>
              ))}
            </p>
          ) : null}
        </div>

        <MarginNote arrow="up-left" className="max-lg:flex-row max-lg:items-start max-lg:gap-2">
          this is the address every site you visit sees — including the ones you never asked to be
          seen by
        </MarginNote>
      </div>

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
    </section>
  );
}
