import type { IpInfo } from "../types.ts";

export function flag(code: string | undefined): string {
  if (code?.length !== 2) return "";
  return code
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join("");
}

export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function isSuccessfulLookup(d: IpInfo | null | undefined): boolean {
  return d?.status === "success" && !!d.query;
}

export function formatPlace(d: IpInfo): string {
  return [d.city, d.regionName, d.country].filter(Boolean).join(", ");
}

export function networkLabel(d: IpInfo): string {
  return [d.asname, d.org || d.isp].filter(Boolean).join(" / ");
}
