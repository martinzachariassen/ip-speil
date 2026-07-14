import { esc } from "./format.ts";

// All ids are static in index.html, so a miss is a programming error.
export function byId(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing element #${id}`);
  return el;
}

export function fact(label: string, valHtml: string | null | undefined): string {
  if (!valHtml) return "";
  return `<div class="fact"><div class="fact-l">${esc(label)}</div><div class="fact-v">${valHtml}</div></div>`;
}

export function kv(key: string, valHtml: string | null | undefined, mono = false): string {
  if (!valHtml) return "";
  return `<div class="kv"><span class="kv-k">${esc(key)}</span><span class="kv-v${mono ? " m" : ""}">${valHtml}</span></div>`;
}

export function note(dotType: string, title: string, desc?: string): string {
  return `<div class="note"><span class="dot ${dotType}"></span><span><b>${esc(title)}</b>${desc ? `<small>${esc(desc)}</small>` : ""}</span></div>`;
}
