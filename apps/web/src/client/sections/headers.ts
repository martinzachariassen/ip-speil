import { clientHintsStatus, isClientHintHeader } from "../lib/client-hints.ts";
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

// The high-entropy hints we asked for (Accept-CH) get their own block, so the
// user can see what the browser volunteered on request versus what it always
// sends. Everything else is "unprompted".
function clientHintsBlock(headers: HeaderMap): string {
  const statuses = clientHintsStatus(headers);
  const answered = statuses.filter((s) => s.value !== null);

  let html = `<div class="sub-l">${esc("Client Hints this site requested")}</div>`;
  html += `<p class="body-intro">Unlike the headers above, these were not sent automatically. This page opted in with an <span class="m">Accept-CH</span> response header, and a Chromium-based browser answers on its next request — without prompting you. Firefox and Safari send nothing here.</p>`;

  if (answered.length === 0) {
    return (
      html +
      note(
        "ok",
        "No high-entropy hints returned",
        "Your browser did not answer the Accept-CH request — typical of Firefox and Safari, which don't support these hints.",
      )
    );
  }

  for (const s of statuses) {
    html += kv(
      s.header,
      s.value !== null
        ? `<span class="m">${esc(s.value)}</span>`
        : `<span class="muted">${esc("— not sent")}</span>`,
    );
  }
  return html;
}

export function renderHeaders(headers: HeaderMap) {
  const el = byId("body-headers");
  // Pull the solicited high-entropy hints out of the general list.
  const entries = Object.entries(headers).filter(([k]) => !isClientHintHeader(k));
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
    `<p class="body-intro">${esc("These headers were sent to this page unprompted. Other sites may receive a slightly different set depending on browser policy, permissions, and server opt-ins.")}</p>` +
    (rows ||
      note("off", "Headers unavailable", "The headers endpoint returned no visible headers.")) +
    clientHintsBlock(headers);
}
