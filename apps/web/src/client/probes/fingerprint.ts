import { sha256Hex } from "../lib/hash.ts";
import type { FingerprintData, WebGLInfo } from "../types.ts";

export function getWebGL(): WebGLInfo | null {
  try {
    const c = document.createElement("canvas");
    const gl = (c.getContext("webgl") ||
      c.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: String(
        ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      ),
      vendor: String(ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR)),
    };
  } catch {
    return null;
  }
}

async function getCanvasHash(): Promise<string | null> {
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
    return await sha256Hex(c.toDataURL());
  } catch {
    return null;
  }
}

// Small differences in the platform audio stack produce stable, distinct
// outputs across devices/browsers, which trackers exploit.
async function getAudioHash(): Promise<string | null> {
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
    return await sha256Hex(sum.toString());
  } catch {
    return null;
  }
}

function getColorGamut(): string {
  if (matchMedia("(color-gamut: rec2020)").matches) return "rec2020";
  if (matchMedia("(color-gamut: p3)").matches) return "p3 (wide)";
  if (matchMedia("(color-gamut: srgb)").matches) return "sRGB";
  return "unknown";
}

const BASE_FONTS = ["monospace", "sans-serif", "serif"];
const TEST_FONTS = [
  "Arial",
  "Verdana",
  "Times New Roman",
  "Courier New",
  "Georgia",
  "Garamond",
  "Comic Sans MS",
  "Trebuchet MS",
  "Impact",
  "Helvetica",
  "Calibri",
  "Cambria",
  "Consolas",
  "Segoe UI",
  "Roboto",
  "Menlo",
  "Monaco",
  "Ubuntu",
  "Noto Sans",
  "Tahoma",
];

// A font is "present" when rendering the probe string in it changes the metrics
// versus the generic base family it falls back to.
function detectFonts(): string[] {
  try {
    const span = document.createElement("span");
    span.style.position = "absolute";
    span.style.left = "-9999px";
    span.style.fontSize = "72px";
    span.textContent = "mmmmmmmmmmlli";
    document.body.appendChild(span);

    const baseline: Record<string, { w: number; h: number }> = {};
    for (const base of BASE_FONTS) {
      span.style.fontFamily = base;
      baseline[base] = { w: span.offsetWidth, h: span.offsetHeight };
    }

    const found: string[] = [];
    for (const font of TEST_FONTS) {
      const detected = BASE_FONTS.some((base) => {
        span.style.fontFamily = `'${font}',${base}`;
        return span.offsetWidth !== baseline[base].w || span.offsetHeight !== baseline[base].h;
      });
      if (detected) found.push(font);
    }
    document.body.removeChild(span);
    return found;
  } catch {
    return [];
  }
}

function countVoices(): Promise<number> {
  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) return resolve(0);
      const now = synth.getVoices();
      if (now.length) return resolve(now.length);
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        resolve(synth.getVoices().length);
      };
      synth.addEventListener("voiceschanged", finish, { once: true });
      setTimeout(finish, 500);
    } catch {
      resolve(0);
    }
  });
}

async function countDevices(): Promise<FingerprintData["devices"]> {
  try {
    if (!navigator.mediaDevices?.enumerateDevices) return null;
    const devices = await navigator.mediaDevices.enumerateDevices();
    return {
      audioIn: devices.filter((d) => d.kind === "audioinput").length,
      audioOut: devices.filter((d) => d.kind === "audiooutput").length,
      videoIn: devices.filter((d) => d.kind === "videoinput").length,
    };
  } catch {
    return null;
  }
}

function storageVectors(): FingerprintData["storage"] {
  const safe = (fn: () => boolean) => {
    try {
      return fn();
    } catch {
      return false;
    }
  };
  return {
    localStorage: safe(() => !!window.localStorage),
    indexedDB: safe(() => !!window.indexedDB),
    cacheAPI: safe(() => "caches" in window),
    serviceWorker: safe(() => "serviceWorker" in navigator),
  };
}

export async function collectFingerprint(): Promise<FingerprintData> {
  const [canvas, audio, voices, devices] = await Promise.all([
    getCanvasHash(),
    getAudioHash(),
    countVoices(),
    countDevices(),
  ]);
  const conn =
    navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;

  return {
    canvas,
    audio,
    webgl: getWebGL(),
    screen: `${screen.width}×${screen.height} @ ${screen.colorDepth}-bit`,
    dpr: window.devicePixelRatio || 1,
    cpu: navigator.hardwareConcurrency || null,
    memory: navigator.deviceMemory ?? null,
    touch: navigator.maxTouchPoints || 0,
    gamut: getColorGamut(),
    hdr: matchMedia("(dynamic-range: high)").matches,
    platform: navigator.platform || "Not exposed",
    fonts: detectFonts(),
    voices,
    devices,
    storage: storageVectors(),
    languages: [...(navigator.languages || [navigator.language])],
    connection: conn
      ? {
          type: conn.type,
          effectiveType: conn.effectiveType,
          downlink: conn.downlink,
          rtt: conn.rtt,
          saveData: conn.saveData,
        }
      : null,
  };
}
