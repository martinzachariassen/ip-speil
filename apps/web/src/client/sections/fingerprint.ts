import { byId, kv, note } from "../lib/dom.ts";
import { esc } from "../lib/format.ts";
import type { EntropyEstimate, FingerprintData } from "../types.ts";

export function renderFingerprint(fp: FingerprintData, entropy: EntropyEstimate) {
  const el = byId("body-fingerprint");
  const dot = entropy.bits >= 26 ? "bad" : entropy.bits >= 18 ? "warn" : "ok";

  const badge = byId("badge-fingerprint");
  badge.textContent = "1 notice";
  badge.hidden = entropy.bits < 18;

  let html = note(
    dot,
    `Fingerprint distinctiveness: ${entropy.rarity}`,
    `About ${entropy.bits} bits of identifying information are exposed here — the more distinctive signals, the fewer browsers look like yours. This is a local, order-of-magnitude estimate (EFF Cover Your Tracks method); it is not a "1 in N" population figure, since we measure no population.`,
  );

  if (entropy.contributions.length) {
    html += `<div class="sub-l">${esc("What makes this browser identifiable")}</div>`;
    for (const c of entropy.contributions) {
      html += kv(c.label, c.bits === 1 ? `~${c.bits} bit` : `~${c.bits} bits`);
    }
  }

  if (fp.canvas) html += kv("Canvas fingerprint", `<span class="m">${esc(fp.canvas)}…</span>`);
  if (fp.audio) html += kv("Audio fingerprint", `<span class="m">${esc(fp.audio)}…</span>`);
  if (fp.webgl) {
    html += kv("GPU renderer", esc(fp.webgl.renderer));
    html += kv("GPU vendor", esc(fp.webgl.vendor));
  }
  html += kv("Screen", `<span class="m sm">${esc(fp.screen)}</span>`);
  html += kv("Device pixel ratio", `${fp.dpr}×`);
  if (fp.cpu) html += kv("CPU threads", `${fp.cpu}`);
  if (fp.memory) html += kv("Device memory", `${fp.memory} GB`);
  html += kv("Touch support", fp.touch > 0 ? `Yes (${fp.touch} points)` : "No");
  html += kv("Color gamut", fp.gamut);
  html += kv("HDR", fp.hdr ? "Yes" : "No");
  html += kv("Platform", esc(fp.platform));
  if (fp.fonts.length) html += kv("Fonts detected", `${fp.fonts.length} of a common set`);
  if (fp.voices) html += kv("Speech voices", `${fp.voices}`);
  if (fp.devices) {
    html += kv(
      "Media devices",
      `${fp.devices.audioIn} mic · ${fp.devices.audioOut} out · ${fp.devices.videoIn} cam`,
    );
  }
  const s = fp.storage;
  const yn = (on: boolean) => (on ? "Available" : "Blocked");
  html += `<div class="sub-l">${esc("Storage & state surfaces")}</div>`;
  html += kv("Cookies", yn(s.cookies));
  html += kv("localStorage", yn(s.localStorage));
  html += kv("sessionStorage", yn(s.sessionStorage));
  html += kv("IndexedDB", yn(s.indexedDB));
  html += kv("Cache API", yn(s.cacheAPI));
  html += kv("Service workers", yn(s.serviceWorker));
  html += kv("Storage Access API", yn(s.storageAccessApi));
  if (s.quotaMb != null) html += kv("Storage quota", `~${s.quotaMb.toLocaleString()} MB`);

  if (fp.connection) {
    html += `<div class="sub-l">${esc("Connection — also a tracking signal")}</div>`;
    const c = fp.connection;
    if (c.type) html += kv("Type", esc(c.type));
    if (c.effectiveType) html += kv("Effective type", esc(c.effectiveType));
    if (c.downlink != null) html += kv("Est. downlink", `${c.downlink} Mbps`);
    if (c.rtt != null) html += kv("RTT", `${c.rtt} ms`);
    if (c.saveData != null) html += kv("Data saver", c.saveData ? "On" : "Off");
  }

  el.innerHTML = html;
}
