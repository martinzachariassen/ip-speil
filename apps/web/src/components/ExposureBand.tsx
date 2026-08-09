import { Readout, ReadoutCell } from "@martinzachariassen/design";
import type { ExposureItem } from "../lib/exposure.ts";
import { SEVERITY_LABEL, severityVariant, Skel } from "./primitives.tsx";

/**
 * The five headline readings, on one line, under the address.
 *
 * This is the answer for anyone who came to check one thing and leave. It says
 * what it found in words — the dot only agrees with the text, never carries it —
 * and each reading names its state to a screen reader, since "Oslo, NO" alone
 * doesn't say whether that's a problem.
 *
 * It stays inside the container's gutter rather than bleeding to the screen
 * edge. The band's first cell is flush left so it lines up with the address
 * above it, and bleeding would put that first label hard against the edge of a
 * phone with nothing between it and the bezel.
 */
export function ExposureBand({ items }: { items: ExposureItem[] | null }) {
  if (!items) {
    return (
      <div className="mt-8 flex gap-4 border-line border-y py-3.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="min-w-0 flex-1" aria-hidden="true">
            <Skel className="mb-2 block h-2.5 w-16" />
            <Skel className="block h-3.5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <Readout aria-label="What sites can see" className="mt-8">
      {items.map((item) => (
        <ReadoutCell
          key={item.key}
          label={item.short ?? item.label}
          dot={severityVariant(item.severity)}
        >
          <span className="sr-only">{SEVERITY_LABEL[item.severity]}: </span>
          {item.detail ?? "—"}
        </ReadoutCell>
      ))}
    </Readout>
  );
}
