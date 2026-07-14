import type { Handler } from "hono";

import { CACHE_CONTROL } from "../config.ts";

const HIDDEN_HEADERS = new Set([
  "connection",
  "host",
  "keep-alive",
  "proxy-authorization",
  "proxy-authenticate",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

function visibleHeaders(headers: Headers): Record<string, string> {
  const visible: Record<string, string> = {};
  headers.forEach((value, key) => {
    if (!HIDDEN_HEADERS.has(key)) visible[key] = value;
  });
  return visible;
}

export const headersRoute = (): Handler => (c) => {
  c.header("Cache-Control", CACHE_CONTROL.noStore);
  return c.json(visibleHeaders(c.req.raw.headers));
};
