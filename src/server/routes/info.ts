import type { Context, Handler } from "hono";

import { CACHE_CONTROL } from "../config.ts";
import { BudgetExhaustedError } from "../lib/cache.ts";
import { isProbablyIp } from "../lib/client-ip.ts";
import type { IpService } from "../lib/ip-service.ts";

export interface InfoRouteDeps {
  lookup: IpService;
  clientIpFor: (c: Context) => string;
}

export function infoRoute({ lookup, clientIpFor }: InfoRouteDeps): Handler {
  return async (c) => {
    const requested = c.req.query("ip")?.trim() ?? "";
    if (requested && !isProbablyIp(requested)) {
      return c.json({ error: "invalid_ip" }, 400);
    }

    const ip = requested || clientIpFor(c);
    try {
      const data = await lookup(ip);
      c.header("Cache-Control", CACHE_CONTROL.noStore);
      return c.json(data);
    } catch (err) {
      if (err instanceof BudgetExhaustedError) {
        return c.json({ error: "budget_exhausted" }, 503);
      }
      return c.json(
        { error: "upstream_failed", message: err instanceof Error ? err.message : String(err) },
        502,
      );
    }
  };
}
