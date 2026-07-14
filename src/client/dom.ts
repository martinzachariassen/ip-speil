// Small HTML render primitives and DOM helpers. Each render helper returns an
// HTML string ("" when empty); none touch the DOM or hold state.
import { esc } from "./format.ts";

/** Get an element by id, asserting it exists (all ids are static in index.html). */
export function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

/** A labelled fact card. */
export function fact(label: string, valHtml: string | null | undefined): string {
  if (valHtml === null || valHtml === undefined || valHtml === "") return "";
  return `<div class="fact"><div class="fact-l">${esc(label)}</div><div class="fact-v">${valHtml}</div></div>`;
}

/** A key/value row, optionally monospaced. */
export function kv(key: string, valHtml: string | null | undefined, mono = false): string {
  if (valHtml === null || valHtml === undefined || valHtml === "") return "";
  return `<div class="kv"><span class="kv-k">${esc(key)}</span><span class="kv-v${mono ? " m" : ""}">${valHtml}</span></div>`;
}

/** A status note with a coloured dot (dotType: ok | warn | bad | off). */
export function note(dotType: string, title: string, desc?: string): string {
  return `<div class="note"><span class="dot ${dotType}"></span><span><b>${esc(title)}</b>${desc ? `<small>${esc(desc)}</small>` : ""}</span></div>`;
}
