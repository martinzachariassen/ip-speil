import { useState } from "react";
import { flag, isSuccessfulLookup } from "../lib/format.ts";
import { cx } from "../lib/cx.ts";
import type { Verdict } from "../lib/exposure.ts";
import type { Scan } from "../hooks/useScan.ts";
import { useFlash } from "../hooks/useFlash.ts";
import { Icon, type IconName } from "@martinzachariassen/design";
import { Button, Dot, type Severity, Skel } from "./primitives.tsx";

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
      <Icon name={flash ? "check" : icon} size="sm" className="flex-none" aria-hidden />
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
  // A single polite live region announces every action's outcome to screen
  // readers (the visible flash covers sighted users).
  const [status, setStatus] = useState("");
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
      setStatus(`${family} address ${ip} copied to clipboard`);
      setTimeout(() => setIpCopied(false), 1800);
    });
  }

  function copyV6() {
    if (!v6) return;
    copy(v6).then(() => {
      flashV6("Copied");
      setStatus("IPv6 address copied to clipboard");
    });
  }

  return (
    <aside className="flex min-w-0 flex-col px-5 pt-[clamp(20px,4.5vw,34px)] pb-1 max-[899px]:pb-1 min-[900px]:sticky min-[900px]:top-0 min-[900px]:h-dvh min-[900px]:overflow-y-auto min-[900px]:border-r min-[900px]:border-line min-[900px]:px-[30px] min-[900px]:pt-[30px] min-[900px]:pb-6 min-[1140px]:px-[34px] min-[1140px]:pt-[34px]">
      <header className="flex min-w-0 flex-wrap items-baseline gap-x-[9px] gap-y-1 font-mono text-[13px] tracking-[0.01em]">
        <b className="font-semibold text-ink">ip-speil</b>
        <em className="text-ink-faint not-italic max-[380px]:hidden">— your internet mirror</em>
      </header>

      {/* Screen-reader-only running commentary for clipboard/share actions. */}
      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>

      {/* hero — the identity card */}
      <div className="mt-[clamp(24px,4vh,40px)] rounded-xl border border-line bg-panel p-4 min-[900px]:p-[18px]">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10.5px] tracking-[0.16em] text-ink-faint uppercase">
            Your public IP
          </span>
          <span
            className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] text-ink-soft uppercase"
            title={loading ? "Scan in progress" : hasLookup ? "Live result" : "No result"}
          >
            <Dot severity={loading ? "off" : hasLookup ? "ok" : "bad"} pulse={loading} />
            {loading ? "Checking" : hasLookup ? family : "Offline"}
          </span>
        </div>

        <div className="mt-2.5 min-w-0 break-words font-mono text-[clamp(26px,7.6vw,33px)] font-semibold leading-[1.1] tracking-[-0.01em] text-ink min-[900px]:text-[clamp(27px,2.9vw,33px)]">
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
          disabled={!hasLookup}
          aria-label={hasLookup ? `Copy your ${family} address` : "No IP to copy"}
          className={cx(
            "mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[9px] border-0 px-4 py-3 font-mono text-[11.5px] font-semibold uppercase tracking-[0.06em] transition-colors duration-150 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50",
            ipCopied
              ? "bg-ok text-paper"
              : "bg-ink text-paper hover:bg-accent hover:text-accent-foreground",
          )}
        >
          <Icon name={ipCopied ? "check" : "copy"} size="xs" className="flex-none" aria-hidden />
          <span>{ipCopied ? "Copied" : hasLookup ? "Copy IP" : "Try refresh"}</span>
        </button>

        {v6 && v6 !== ip ? (
          <div className="mt-2.5 flex items-stretch overflow-hidden rounded-[9px] border border-dashed border-line-2">
            <span
              title={v6}
              className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-2.5 font-mono text-[11px] text-ink-soft"
            >
              <span className="shrink-0 text-[9px] tracking-[0.08em] text-ink-faint uppercase">
                v6
              </span>
              <span className="min-w-0 flex-1 truncate">{shortV6(v6)}</span>
            </span>
            <button
              type="button"
              onClick={copyV6}
              aria-label="Copy your IPv6 address"
              className="flex shrink-0 items-center gap-1.5 self-stretch border-l border-dashed border-line-2 px-3 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-ink-soft transition-colors duration-150 hover:bg-ink hover:text-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
            >
              <Icon name={v6Flash ? "check" : "copy"} size="xs" className="flex-none" aria-hidden />
              <span>{v6Flash ?? "Copy"}</span>
            </button>
          </div>
        ) : null}

        <div className="mt-3.5 break-words border-t border-line-soft pt-3 text-[14px] leading-[1.5] text-ink-soft">
          {loading ? (
            <Skel className="h-[1em] w-60 max-w-[80%]" />
          ) : hasLookup ? (
            <>
              {d?.isp ? <div className="text-ink">{d.isp}</div> : null}
              {place ? (
                <div>
                  {f ? <span aria-hidden>{`${f} `}</span> : ""}
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
        className={cx(
          "mt-4 flex gap-[11px] rounded-xl border border-l-[3px] bg-panel px-4 py-3.5",
          VERDICT_ACCENT[verdict?.severity ?? "off"],
        )}
      >
        <Dot severity={verdict?.severity ?? "off"} pulse className="mt-[5px]" />
        <div className="min-w-0">
          <div className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink">
            {loading || !verdict ? <Skel className="h-[1em] w-60 max-w-[80%]" /> : verdict.title}
          </div>
          <div className="mt-0.5 text-[13px] leading-[1.5] text-ink-soft">{verdict?.sub ?? ""}</div>
        </div>
      </div>

      {/* actions — a fixed 2-col grid so a label swap on click (e.g. "Share" →
          "Link copied") can never change a button's width and reshuffle the row */}
      <div role="group" aria-label="Scan actions" className="mt-4 grid grid-cols-2 gap-2">
        <Button
          onClick={onRefresh}
          className="col-span-2 w-full whitespace-nowrap"
          aria-label="Run a fresh scan"
        >
          <Icon
            name="refresh-cw"
            size="sm"
            className={cx(loading && "animate-spin")}
            aria-hidden
          />
          <span>Refresh</span>
        </Button>
        <Button
          variant="ghost"
          className="w-full whitespace-nowrap"
          onClick={() =>
            onCopyReport().then((ok) => {
              if (ok) {
                flashReport("Copied");
                setStatus("Diagnostics report copied to clipboard");
              }
            })
          }
          aria-label="Copy redacted diagnostics report to clipboard"
        >
          <ActionLabel icon="clipboard" label="Copy report" flash={reportFlash} />
        </Button>
        <Button
          variant="ghost"
          className="w-full whitespace-nowrap"
          onClick={() => {
            if (onSnapshot()) {
              flashSnap("Saved");
              setStatus("Snapshot saved locally");
            }
          }}
          aria-label="Save this scan locally to compare against later"
        >
          <ActionLabel icon="save" label="Snapshot" flash={snapFlash} />
        </Button>
        <Button
          variant="ghost"
          className="w-full whitespace-nowrap"
          onClick={() =>
            onShare().then((ok) => {
              if (ok) {
                flashShare("Link copied");
                setStatus("Shareable link copied to clipboard");
              }
            })
          }
          aria-label="Copy a shareable link containing the redacted report"
        >
          <ActionLabel icon="share-2" label="Share" flash={shareFlash} />
        </Button>
        <Button
          variant="ghost"
          className="w-full whitespace-nowrap"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          <Icon name={theme === "dark" ? "sun" : "moon"} size="sm" aria-hidden />
          <span>{theme === "dark" ? "Light" : "Dark"}</span>
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

// A thin left rule tints the verdict card by severity — a colour cue that rides
// alongside the status dot, never replacing the text.
const VERDICT_ACCENT: Record<Severity, string> = {
  ok: "border-line border-l-ok",
  warn: "border-line border-l-warn",
  bad: "border-line border-l-destructive",
  off: "border-line border-l-line-2",
};
