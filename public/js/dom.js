// @ts-check
// Small HTML render primitives. Each returns an HTML string ("" when empty).
import { esc } from "./format.js";

/** A labelled fact card. */
export function fact(label, valHtml) {
  if (valHtml === null || valHtml === undefined || valHtml === "") return "";
  return `<div class="fact"><div class="fact-l">${esc(label)}</div><div class="fact-v">${valHtml}</div></div>`;
}

/** A key/value row, optionally monospaced. */
export function kv(key, valHtml, mono = false) {
  if (valHtml === null || valHtml === undefined || valHtml === "") return "";
  return `<div class="kv"><span class="kv-k">${esc(key)}</span><span class="kv-v${mono ? " m" : ""}">${valHtml}</span></div>`;
}

/** A status note with a coloured dot (dotType: ok | warn | bad | off). */
export function note(dotType, title, desc) {
  return `<div class="note"><span class="dot ${dotType}"></span><span><b>${esc(title)}</b>${desc ? `<small>${esc(desc)}</small>` : ""}</span></div>`;
}
