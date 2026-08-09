import { Text } from "@martinzachariassen/design";

/**
 * A ruled box with a pin where the geo lookup thinks you are.
 *
 * Deliberately **not** a map. Drawing real tiles would mean either a third-party
 * tile server — which sees the visitor's IP, the exact thing this page exists to
 * talk about — or shipping vector data for a decorative 130px strip. The ruled
 * grid says "an estimate on a coordinate system" without pretending to a
 * precision the data doesn't have; the coordinates underneath are the real
 * answer, and the row beside it says the accuracy out loud.
 */
export function GeoMap({ lat, lon }: { lat: number; lon: number }) {
  return (
    <div
      // Longitude → x and latitude → y, clamped well inside the box: the pin
      // shows the reading is *somewhere*, at the right hemisphere-ish offset,
      // without implying the box is a projection of anywhere in particular.
      className="relative mb-3 h-[132px] overflow-hidden rounded-[var(--radius-md)] border border-line bg-paper-2"
      style={{
        backgroundImage:
          "linear-gradient(to right, color-mix(in oklch, var(--border) 60%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklch, var(--border) 60%, transparent) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
    >
      <span
        aria-hidden="true"
        className="absolute size-3"
        style={{
          left: `${clamp(((lon + 180) / 360) * 100)}%`,
          top: `${clamp(((90 - lat) / 180) * 100)}%`,
        }}
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-accent-deep opacity-55 motion-reduce:hidden" />
        <span className="absolute inset-0 rounded-full bg-accent-deep" />
      </span>
      <Text
        variant="mono"
        className="absolute right-2 bottom-1.5 text-[11px] text-ink-soft"
      >
        {lat.toFixed(4)} {lat >= 0 ? "N" : "S"} · {lon.toFixed(4)} {lon >= 0 ? "E" : "W"}
      </Text>
    </div>
  );
}

/** Keep the pin off the border so it never half-disappears. */
function clamp(percent: number): number {
  return Math.min(92, Math.max(4, percent));
}
