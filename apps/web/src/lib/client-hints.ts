import type { HeaderMap } from "../types.ts";

// High-entropy User-Agent Client Hints this site solicits via the `Accept-CH`
// response header (see apps/web/public/_headers). Browsers do NOT send these by
// default: Chromium only adds them once a site opts in, and Firefox/Safari never
// send them at all. Keep this list in sync with the `Accept-CH` header.
export const REQUESTED_CLIENT_HINTS = [
  "sec-ch-ua-full-version-list",
  "sec-ch-ua-platform-version",
  "sec-ch-ua-arch",
  "sec-ch-ua-model",
  "sec-ch-ua-bitness",
] as const;

export interface ClientHintStatus {
  header: string;
  value: string | null; // null → the browser did not send it
}

function headerValue(headers: HeaderMap, key: string): string | null {
  const v = headers[key];
  if (v == null) return null;
  return Array.isArray(v) ? v.join(", ") : v;
}

// Presence/absence of each solicited hint. We report *whether* a hint came back,
// and (for the UI) its value if so — never inferring anything the header itself
// doesn't already state.
export function clientHintsStatus(headers: HeaderMap): ClientHintStatus[] {
  return REQUESTED_CLIENT_HINTS.map((h) => ({ header: h, value: headerValue(headers, h) }));
}

export function anyClientHintAnswered(headers: HeaderMap): boolean {
  return clientHintsStatus(headers).some((h) => h.value !== null);
}

export function isClientHintHeader(key: string): boolean {
  return (REQUESTED_CLIENT_HINTS as readonly string[]).includes(key);
}
