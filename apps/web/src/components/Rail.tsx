import { useState } from "react";
import { flag, isSuccessfulLookup } from "../lib/format.ts";
import { cx } from "../lib/cx.ts";
import type { Verdict } from "../lib/exposure.ts";
import type { Scan } from "../hooks/useScan.ts";
import { useFlash } from "../hooks/useFlash.ts";
import { Icon, type IconName } from "@martinzachariassen/design";
import { Button, Dot, Skel } from "./primitives.tsx";

// Button content: a leading icon + label. On transient success (`flash` set) the
// icon swaps to a check and the label shows the flash text — no glyph in a string.
function ActionLabel({
  icon,
  label,
  flash,
}: {
  icon: IconName;
  label: string;
  flash: string | null;
}) {
  return (
    <>
      <Icon name={flash ? "check" : icon} size="sm" className="flex-none" />
      <span>{flash ?? label}</span>
    </>
  );
}

// Middle-truncate a long IPv6 so the rail chip stays one line; the full address
// is in the title attribute and is what the copy button copies.
function shortV6(ip: string): string {
  const parts = ip.split(":");
  return parts.length > 5 ? `${parts.slice(0, 4).join(":")}:…:${parts[parts.length - 1]}` : ip;
}

function copy(text: string): Promise<void> {
  return navigator.clipboard?.writeText(text) ?? Promise.reject();
}

interface RailProps {
  scan: Scan | null;
  verdict: Verdict | null;
  loading: boolean;
  theme: "light" | "dark";
  onRefresh: () => void;
  onCopyReport: () => Promise<boolean>;
  onSnapshot: () => boolean;
  onShare: () => Promise<boolean>;
  onToggleTheme: () => void;
}

export function Rail({
  scan,
  verdict,
  loading,
  theme,
  onRefresh,
  onCopyReport,
  onSnapshot,
  onShare,
  onToggleTheme,
}: RailProps) {
  const [ipCopied, setIpCopied] = useState(false);
  const [v6Flash, flashV6] = useFlash();
  const [reportFlash, flashReport] = useFlash();
  const [snapFlash, flashSnap] = useFlash();
  const [shareFlash, flashShare] = useFlash();

  const d = scan?.data ?? null;
  const hasLookup = d ? isSuccessfulLookup(d) : false;
  const ip = hasLookup ? (d?.query ?? "") : "";
  const v6 = scan?.exits.v6 ?? null;
  const family = ip.includes(":") ? "IPv6" : "IPv4";

  const place = d ? [d.city, d.country].filter(Boolean).join(", ") : "";
  const f = d ? flag(d.countryCode) : "";

  function copyIp() {
    if (!ip) return;
    copy(ip).then(() => {
      setIpCopied(true);
      setTimeout(() => setIpCopied(false), 1800);
    });
  }

  function copyV6() {
    if (!v6) return;
    copy(v6).then(() => flashV6("copied"));
  }

  return (
    <aside className="flex min-w-0 flex-col px-5 pt-[clamp(20px,4.5vw,34px)] pb-1 max-[899px]:pb-1 min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-dvh min-[900px]:overflow-y-auto min-[900px]:border-r min-[900px]:border-line min-[900px]:px-[30px] min-[900px]:pt-[30px] min-[900px]:pb-6 min-[1140px]:px-[34px] min-[1140px]:pt-[34px]">
      <header className="flex min-w-0 flex-wrap items-baseline gap-x-[9px] gap-y-1 font-mono text-[13px] tracking-[0.01em]">
        <b className="font-semibold text-ink">ip-speil</b>
        <em className="text-ink-faint not-italic max-[380px]:hidden">— your internet mirror</em>
      </header>

      {/* hero */}
      <div className="mt-[clamp(26px,4vh,44px)]">
        <div className="font-mono text-[10.5px] tracking-[0.16em] text-ink-faint uppercase">
          Your public IP
        </div>
        <div className="mt-2.5 min-w-0 break-words font-mono text-[clamp(27px,8vw,34px)] font-semibold leading-[1.1] tracking-[-0.01em] text-ink min-[900px]:text-[clamp(28px,3vw,34px)]">
          {loading ? (
            <Skel className="h-[0.82em] w-[min(240px,62vw)]" />
          ) : hasLookup && ip ? (
            // Zero-width space after each colon lets IPv6 wrap at hextet boundaries.
            ip.replace(/:/g, ":​")
          ) : (
            "Unavailable"
          )}
        </div>

        <button
          type="button"
          onClick={copyIp}
          title="Copy your public IP"
          className={cx(
            "mt-4 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[9px] border-0 px-4 py-3 font-mono text-[11.5px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150 focus-visible:outline-offset-4",
            ipCopied
              ? "bg-ok text-paper"
              : "bg-ink text-paper hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Icon name={ipCopied ? "check" : "copy"} size="xs" className="flex-none" />
          <span>{ipCopied ? "copied" : hasLookup ? `copy ${family}` : "try refresh"}</span>
        </button>

        {v6 && v6 !== ip ? (
          <div className="mt-2.5 flex items-stretch gap-2">
            <span
              title={v6}
              className="flex min-w-0 flex-1 items-center break-words rounded-[7px] border border-dashed border-line-2 px-2.5 py-[7px] font-mono text-[11px] text-ink-soft"
            >
              {shortV6(v6)}
            </span>
            <Button mini onClick={copyV6} title="Copy your IPv6 address">
              <ActionLabel icon="copy" label="copy v6" flash={v6Flash} />
            </Button>
          </div>
        ) : null}

        <div className="mt-3.5 break-words text-[14px] leading-[1.5] text-ink-soft">
          {loading ? (
            <Skel className="h-[1em] w-60 max-w-[80%]" />
          ) : hasLookup ? (
            <>
              {d?.isp ? <div>{d.isp}</div> : null}
              {place ? (
                <div>
                  {f ? `${f} ` : ""}
                  {place}
                </div>
              ) : null}
            </>
          ) : (
            <div>IP lookup failed or returned no usable result</div>
          )}
        </div>
      </div>

      {/* verdict card */}
      <div
        aria-live="polite"
        className="mt-6 flex gap-[11px] rounded-xl border border-line bg-panel px-4 py-3.5"
      >
        <Dot severity={verdict?.severity ?? "off"} pulse className="mt-[5px]" />
        <div className="min-w-0">
          <div className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink">
            {loading || !verdict ? <Skel className="h-[1em] w-60 max-w-[80%]" /> : verdict.title}
          </div>
          <div className="mt-0.5 text-[12.5px] leading-[1.5] text-ink-soft">
            {verdict?.sub ?? ""}
          </div>
        </div>
      </div>

      {/* actions */}
      <div className="mt-4 flex flex-wrap gap-2 max-[380px]:flex-col max-[380px]:items-stretch">
        <Button onClick={onRefresh} className="max-[380px]:w-full">
          <Icon name="refresh-cw" size="sm" className={cx(loading && "animate-spin")} />
          <span>Refresh</span>
        </Button>
        <Button
          variant="ghost"
          onClick={() => onCopyReport().then((ok) => ok && flashReport("Copied"))}
          title="Copy redacted diagnostics report"
        >
          <ActionLabel icon="clipboard" label="Copy report" flash={reportFlash} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => onSnapshot() && flashSnap("Saved")}
          title="Save this scan locally to compare against later"
        >
          <ActionLabel icon="save" label="Snapshot" flash={snapFlash} />
        </Button>
        <Button
          variant="ghost"
          onClick={() => onShare().then((ok) => ok && flashShare("Link copied"))}
          title="Copy a link with the redacted report in the URL fragment"
        >
          <ActionLabel icon="share-2" label="Share" flash={shareFlash} />
        </Button>
        <Button
          variant="ghost"
          onClick={onToggleTheme}
          title="Toggle light/dark"
          aria-label="Toggle light or dark theme"
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size="sm" />
        </Button>
      </div>

      <div className="mt-[26px] flex justify-between gap-3 pt-5 font-mono text-[10.5px] text-ink-faint min-[900px]:mt-auto">
        <span>nothing stored</span>
        <span className="tracking-[0.05em]">
          {d?.lat != null && d?.lon != null ? `${d.lat.toFixed(2)}, ${d.lon.toFixed(2)}` : ""}
        </span>
      </div>
    </aside>
  );
}
