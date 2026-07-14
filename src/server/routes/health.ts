import type { Handler } from "hono";

import { CACHE_CONTROL } from "../config.ts";

export const healthRoute = (): Handler => (c) => {
  c.header("Cache-Control", CACHE_CONTROL.noStore);
  return c.text("ok");
};
