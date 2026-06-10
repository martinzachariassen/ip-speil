// @ts-check
// Browser-fingerprint probes. All computed locally; never sent to the server.

/** WebGL renderer/vendor strings (unmasked when the extension is available). */
export function getWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = /** @type {WebGLRenderingContext | null} */ (
      c.getContext("webgl") || c.getContext("experimental-webgl")
    );
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
    };
  } catch {
    return null;
  }
}

/** A short SHA-256 of a rendered canvas — a classic fingerprinting signal. */
export async function getCanvasHash() {
  try {
    const c = document.createElement("canvas");
    c.width = 240;
    c.height = 60;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, 240, 60);
    ctx.font = "bold 14px Arial";
    ctx.fillStyle = "#60a5fa";
    ctx.fillText("Privacy Check 🔒", 10, 22);
    ctx.font = "11px monospace";
    ctx.fillStyle = "#4ade80";
    ctx.fillText("canvas fingerprint test 1234", 10, 44);
    const data = c.toDataURL();
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(data));
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 24);
  } catch {
    return null;
  }
}

/**
 * AudioContext fingerprint — sums the first 8k samples of a short offline render
 * and hashes them. Small differences in the platform audio stack produce
 * stable, distinct outputs across devices/browsers, which trackers exploit.
 */
export async function getAudioHash() {
  try {
    if (typeof OfflineAudioContext === "undefined") return null;
    const ctx = new OfflineAudioContext(1, 44100, 44100);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 1000;
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -50;
    compressor.knee.value = 40;
    compressor.ratio.value = 12;
    compressor.attack.value = 0;
    compressor.release.value = 0.25;
    osc.connect(compressor);
    compressor.connect(ctx.destination);
    osc.start(0);
    const buffer = await ctx.startRendering();
    const data = buffer.getChannelData(0);
    let sum = 0;
    for (let i = 4500; i < 5000; i += 1) sum += Math.abs(data[i]);
    const hashBytes = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(sum.toString()),
    );
    return [...new Uint8Array(hashBytes)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 24);
  } catch {
    return null;
  }
}

/** Detect the display's colour gamut. */
export function getColorGamut() {
  if (matchMedia("(color-gamut: rec2020)").matches) return "rec2020";
  if (matchMedia("(color-gamut: p3)").matches) return "p3 (wide)";
  if (matchMedia("(color-gamut: srgb)").matches) return "sRGB";
  return "unknown";
}
