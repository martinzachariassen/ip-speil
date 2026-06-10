// @ts-check
// Pure formatting/string helpers shared across the UI.

/** Turn a 2-letter country code into a flag emoji ("" if invalid). */
export function flag(code) {
  if (code?.length !== 2) return "";
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

/** Escape a value for safe interpolation into HTML. */
export function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** True when an ip-api.com lookup succeeded and returned an IP. */
export function isSuccessfulLookup(d) {
  return d?.status === "success" && !!d.query;
}

/** "City, Region, Country" from an ip-api response. */
export function formatPlace(d) {
  return [d.city, d.regionName, d.country].filter(Boolean).join(", ");
}

/** "ASNAME / Org" network label from an ip-api response. */
export function networkLabel(d) {
  return [d.asname, d.org || d.isp].filter(Boolean).join(" / ");
}
