import type { Report } from "../report.ts";
import type { FingerprintData } from "../types.ts";
import { sha256Hex } from "./hash.ts";

const KEY = "ipspeil-snapshot";

export interface Snapshot {
  savedAt: string;
  report: Report;
  // Local-only hash of the fingerprint signals. Stored in localStorage, compared
  // across scans, and NEVER sent anywhere — the raw fingerprint stays on-device.
  fingerprintId: string;
}

// A stable hash over the identifying fingerprint signals. Fonts are sorted so
// enumeration order can't cause a spurious "changed" verdict.
export async function computeFingerprintId(fp: FingerprintData): Promise<string> {
  const stable = JSON.stringify([
    fp.canvas,
    fp.audio,
    fp.webgl?.renderer ?? null,
    fp.webgl?.vendor ?? null,
    fp.screen,
    fp.dpr,
    fp.platform,
    fp.gamut,
    fp.hdr,
    [...fp.fonts].sort().join(","),
    fp.voices,
  ]);
  return sha256Hex(stable, 32);
}

export function loadSnapshot(): Snapshot | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    if (!parsed || typeof parsed !== "object" || !parsed.report) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSnapshot(s: Snapshot): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // localStorage may be unavailable (private mode, disabled) — non-fatal.
  }
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Share links carry the already-redacted report in the URL fragment (#), which
// browsers never send to the server — so the payload stays client-side.
export function encodeShare(report: Report): string {
  return btoa(encodeURIComponent(JSON.stringify(report)));
}

export function decodeShare(fragment: string): Report | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(fragment))) as Report;
    if (!parsed || typeof parsed !== "object" || !parsed.signals) return null;
    return parsed;
  } catch {
    return null;
  }
}
