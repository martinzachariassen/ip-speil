/**
 * Generate ip-speil's brand-asset set — favicons, app icons, and the social /
 * Open-Graph cards — from one source of truth: the **mirror mark** defined below.
 *
 * The mark is built the same way as the MLZ mark in @martinzachariassen/design: a
 * solid polygon glyph on a monochrome ink tile (32×32 grid, ink `#1a1a18` tile +
 * paper `#ecebe4` glyph — the accent never appears in the mark). ip-speil's glyph
 * is two triangles mirroring across a central rule: an upright peak and its
 * dimmed reflection — the "internet mirror" made literal.
 *
 * Everything raster is rendered in headless Chromium at 2× DPI and downsampled to
 * the canonical size (`scale: "css"`) — the same recipe the design system's own
 * `gen-assets` uses, so ip-speil's assets sit in the same visual family.
 *
 *   bun run --filter @ip-speil/web gen:assets     # from repo root
 *   bun scripts/gen-brand-assets.ts               # from apps/web
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page } from "playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(HERE, "..");
const PUBLIC = join(WEB_ROOT, "public");

// ── Fixed brand ink/paper (static exports never read theme vars) ──────────────
const INK = "#1a1a18";
const PAPER = "#ecebe4";
// House tokens (light theme) pulled from the design system's theme.css.
const MUTED = "#63615a";
const BORDER = "#cbc9be";
const ACCENT = "oklch(0.74 0.13 195)"; // --mlz-cyan
const ACCENT_DEEP = "oklch(0.48 0.10 200)"; // --accent-deep (brand period on paper)
const GRID_MINOR = "rgba(26,26,24,0.06)";
const GRID_MAJOR = "rgba(26,26,24,0.09)";
const FRAME = "rgba(203,201,190,0.7)"; // --border @ 70%

// ── The mirror mark ───────────────────────────────────────────────────────────
// Drawn on the 32×32 grid. An upright peak sits on the mirror rule; its dimmed
// reflection hangs below. Symmetric about y=16; glyph spans x 8→24, y 5.5→26.5.
const MIRROR_RULE = `<rect x="6.5" y="15.2" width="19" height="1.6" rx="0.8" fill="${PAPER}"/>`;
const MIRROR_PEAK = `<polygon points="16,5.5 24,15 8,15" fill="${PAPER}"/>`;
const MIRROR_REFLECTION = `<polygon points="16,26.5 24,17 8,17" fill="${PAPER}" opacity="0.45"/>`;
const GLYPH = `${MIRROR_RULE}${MIRROR_PEAK}${MIRROR_REFLECTION}`;

/** Rounded ink tile + mirror glyph — the favicon / app icon (transparent around the tile). */
function roundedTileSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <title>ip-speil</title>
  <rect x="1" y="1" width="30" height="30" rx="6" fill="${INK}"/>
  ${GLYPH}
</svg>`;
}

/** Full-bleed ink square + padded glyph — for apple-touch / maskable icons (no alpha). */
function bleedSvg(pad = 3): string {
  const inner = 32 - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
  <rect width="32" height="32" fill="${INK}"/>
  <g transform="translate(${pad},${pad}) scale(${inner / 32})">${GLYPH}</g>
</svg>`;
}

// The literal favicon.svg written to disk (source of truth — everything else renders).
const FAVICON_SVG = `${roundedTileSvg()}\n`;

// ── Fonts (base64-embedded so the card renders deterministically) ─────────────
function findFont(file: string): string {
  // The design package is `file:../mlz-design`; its fonts are the source of truth.
  const candidates = [
    resolve(WEB_ROOT, "../../../mlz-design/src/styles/fonts", file),
    resolve(WEB_ROOT, "../../../mlz-design/dist/styles/fonts", file),
  ];
  for (const c of candidates) {
    try {
      readFileSync(c);
      return c;
    } catch {}
  }
  throw new Error(`font not found: ${file} (looked in ${candidates.join(", ")})`);
}

function fontFace(family: string, file: string, weight: number): string {
  const b64 = readFileSync(findFont(file)).toString("base64");
  return `@font-face{font-family:"${family}";font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format("woff2");}`;
}

function fontCss(): string {
  return [
    fontFace("Space Mono", "space-mono-400.woff2", 400),
    fontFace("Space Mono", "space-mono-700.woff2", 700),
    fontFace("Space Grotesk", "space-grotesk-500.woff2", 500),
    fontFace("Space Grotesk", "space-grotesk-700.woff2", 700),
  ].join("");
}

// The mirror lockup as inline SVG (mark) + wordmark, echoing BrandLockup.
function lockup(): string {
  const mark = 3.2 * 16; // 51.2px, the OG card's lockup mark size
  const wordmark = mark / 1.45; // BrandLockup proportion
  const gap = wordmark * 0.5;
  const tagSize = Math.max(9, wordmark * 0.32);
  return `<div style="display:inline-flex;align-items:center;gap:${gap}px;color:${INK}">
    <svg width="${mark}" height="${mark}" viewBox="0 0 32 32">
      <rect x="1" y="1" width="30" height="30" rx="6" fill="${INK}"/>${GLYPH}
    </svg>
    <div style="display:flex;flex-direction:column;line-height:1">
      <span style="font-family:'Space Mono';font-weight:700;text-transform:lowercase;letter-spacing:-0.03em;font-size:${wordmark}px;line-height:1">ip-speil<span style="color:${ACCENT_DEEP}">.</span></span>
      <span style="margin-top:4px;font-family:'Space Mono';text-transform:uppercase;letter-spacing:0.22em;font-size:${tagSize}px;color:${MUTED}">your internet mirror</span>
    </div>
  </div>`;
}

// The 1200×630 social / OG card — a faithful rebuild of the design system's
// SocialCard (engineering-notebook frame, ruled grid, corner marks) around the
// ip-speil mirror lockup.
function socialCardHtml(): string {
  const W = 1200;
  const H = 630;
  const grid = `linear-gradient(to right, ${GRID_MINOR} 1px, transparent 1px), linear-gradient(to bottom, ${GRID_MINOR} 1px, transparent 1px), linear-gradient(to right, ${GRID_MAJOR} 1px, transparent 1px), linear-gradient(to bottom, ${GRID_MAJOR} 1px, transparent 1px)`;
  const corner = (pos: string, sides: string) =>
    `<span style="position:absolute;height:1.5em;width:1.5em;${pos};${sides}"></span>`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box}
    ${fontCss()}
    #asset{position:relative;overflow:hidden;width:${W}px;height:${H}px;font-size:16px;background:${PAPER};color:${INK};font-family:'Space Mono'}
  </style></head><body>
  <div id="asset">
    <div style="position:absolute;inset:0;background-image:${grid};background-size:40px 40px,40px 40px,200px 200px,200px 200px"></div>
    <div style="position:absolute;inset:1.5em;border:1px solid ${FRAME}"></div>
    ${corner("top:1.5em;left:1.5em", `border-top:2px solid ${ACCENT};border-left:2px solid ${ACCENT}`)}
    ${corner("top:1.5em;right:1.5em", `border-top:2px solid ${ACCENT};border-right:2px solid ${ACCENT}`)}
    ${corner("bottom:1.5em;left:1.5em", `border-bottom:2px solid ${ACCENT};border-left:2px solid ${ACCENT}`)}
    ${corner("bottom:1.5em;right:1.5em", `border-bottom:2px solid ${ACCENT};border-right:2px solid ${ACCENT}`)}
    <div style="position:relative;display:flex;height:100%;flex-direction:column;justify-content:space-between;padding:4.5em">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        ${lockup()}
        <span style="border:1px solid ${BORDER};background:${PAPER};padding:0.4em 0.9em;border-radius:2px;font-family:'Space Mono';font-size:0.72em;text-transform:uppercase;letter-spacing:0.16em;color:${MUTED}">diagnostics</span>
      </div>
      <div style="max-width:85%">
        <p style="font-family:'Space Mono';font-size:0.9em;text-transform:uppercase;letter-spacing:0.28em;color:${MUTED}">Privacy &amp; network diagnostics</p>
        <h1 style="margin-top:0.5em;font-family:'Space Grotesk';font-weight:700;font-size:4.6em;line-height:0.98;letter-spacing:-0.02em;color:${INK}">See what the internet sees about you.</h1>
        <p style="margin-top:0.9em;max-width:80%;font-family:'Space Mono';font-size:1.15em;line-height:1.6;color:${MUTED}">Your public IP, location, ISP and ASN, VPN / proxy / Tor signals, WebRTC &amp; DNS leaks, IPv6 routing, and browser fingerprint — measured live. No cookies, no logs.</p>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid ${BORDER};padding-top:1.4em">
        <span style="font-family:'Space Mono';font-size:0.95em;text-transform:uppercase;letter-spacing:0.2em;color:${INK}">ip.mlz.no</span>
        <span style="display:flex;align-items:center;gap:0.6em;font-family:'Space Mono';font-size:0.8em;text-transform:uppercase;letter-spacing:0.16em;color:${MUTED}">
          <span style="display:inline-block;width:0.6em;height:0.6em;background:${ACCENT}"></span>open-graph · 1200×630
        </span>
      </div>
    </div>
  </div></body></html>`;
}

// ── Rasterise via Chromium at 2× DPI ──────────────────────────────────────────
async function shootSvg(page: Page, svg: string, size: number, alpha: boolean): Promise<Buffer> {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0}html,body{background:transparent}#asset{width:${size}px;height:${size}px}#asset svg{display:block;width:100%;height:100%}</style></head><body><div id="asset">${svg}</div></body></html>`;
  await page.setViewportSize({ width: Math.max(size, 16), height: Math.max(size, 16) });
  await page.setContent(html, { waitUntil: "load" });
  return page.locator("#asset").screenshot({ omitBackground: alpha, scale: "css" });
}

async function shootCard(page: Page, html: string, w: number, h: number): Promise<Buffer> {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(() => (document as Document).fonts.ready);
  return page.locator("#asset").screenshot({ scale: "css" });
}

/** Pack PNG buffers into a single PNG-in-ICO (read by every browser + OS). */
function encodeIco(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries: Buffer[] = [];
  let offset = 6 + pngs.length * 16;
  for (const { size, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt16LE(1, 4);
    e.writeUInt16LE(32, 6);
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    entries.push(e);
    offset += data.length;
  }
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

function write(file: string, buf: Buffer | string) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
  console.log(`  ✓ ${file.slice(WEB_ROOT.length + 1)}`);
}

async function main() {
  const iconsDir = join(PUBLIC, "assets", "icons");
  const socialDir = join(PUBLIC, "assets", "social");

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ deviceScaleFactor: 2 });
    const page = await ctx.newPage();

    // Static source of truth.
    write(join(iconsDir, "favicon.svg"), FAVICON_SVG);

    // Favicon / app-icon PNGs.
    write(join(iconsDir, "favicon-32.png"), await shootSvg(page, roundedTileSvg(), 32, true));
    write(join(iconsDir, "favicon-192.png"), await shootSvg(page, roundedTileSvg(), 192, true));
    write(join(iconsDir, "apple-touch-icon.png"), await shootSvg(page, bleedSvg(3), 180, false));
    // Maskable icon: full-bleed with a wider safe-zone pad (Android masks to a shape).
    write(
      join(iconsDir, "favicon-192-maskable.png"),
      await shootSvg(page, bleedSvg(4), 192, false),
    );

    // favicon.ico (16 + 32, rounded tile, transparent).
    const ico16 = await shootSvg(page, roundedTileSvg(), 16, true);
    const ico32 = await shootSvg(page, roundedTileSvg(), 32, true);
    write(
      join(PUBLIC, "favicon.ico"),
      encodeIco([
        { size: 16, data: ico16 },
        { size: 32, data: ico32 },
      ]),
    );

    // Social / Open-Graph cards (og + twitter share the render).
    const card = await shootCard(page, socialCardHtml(), 1200, 630);
    write(join(socialDir, "og.png"), card);
    write(join(socialDir, "twitter-card.png"), card);
  } finally {
    await browser.close();
  }
  console.log("\n✓ brand assets generated");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
