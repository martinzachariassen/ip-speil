import { byId, kv, note } from "../lib/dom.ts";
import { esc } from "../lib/format.ts";
import type { HeaderMap } from "../types.ts";

const PRIORITY = [
  "user-agent",
  "accept-language",
  "sec-ch-ua",
  "sec-ch-ua-mobile",
  "sec-ch-ua-platform",
  "sec-fetch-site",
  "sec-fetch-mode",
  "dnt",
  "referer",
];

export function renderHeaders(headers: HeaderMap) {
  const el = byId("body-headers");
  const entries = Object.entries(headers);
  entries.sort(([a], [b]) => {
    const ai = PRIORITY.indexOf(a);
    const bi = PRIORITY.indexOf(b);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return a.localeCompare(b);
  });

  const rows = entries
    .map(([k, v]) => kv(k, `<span class="m">${esc(Array.isArray(v) ? v.join(", ") : v)}</span>`))
    .join("");

  el.innerHTML =
    `<p class="body-intro">These headers were sent to this page. Other sites may receive a slightly different set depending on browser policy, permissions, and server opt-ins.</p>` +
    (rows ||
      note("off", "Headers unavailable", "The headers endpoint returned no visible headers."));
}
