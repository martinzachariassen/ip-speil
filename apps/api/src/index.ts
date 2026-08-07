#!/usr/bin/env bun
import { createApp, DEFAULT_PORT } from "./app.ts";
import { ENABLE_ONLINE_TIEBREAKER, ENABLE_ROUTING } from "./config.ts";
import { datasetMeta, getGeoDb } from "./geoip/load.ts";
import { log } from "./lib/log.ts";
import { refreshTorExits } from "./lib/tor.ts";

const nodeEnv = process.env.NODE_ENV ?? "development";
log.info("api starting", { nodeEnv, logLevel: process.env.LOG_LEVEL ?? "info" });

const proxySecret = process.env.PROXY_SECRET;
if (!proxySecret && nodeEnv === "production") {
  // Fail closed: never boot the public API with the proxy gate disabled.
  log.error("PROXY_SECRET is required in production — it guards /api/info. Exiting.");
  process.exit(1);
}
if (!proxySecret) {
  log.warn("PROXY_SECRET unset — /api/info proxy gate is DISABLED (dev/test only)");
} else {
  log.info("proxy gate enabled — /api/info requires the shared bearer secret");
}

// Warm the local geoip datasets so the first request isn't slowed by the parse.
// Missing datasets degrade gracefully (limited /api/info), so this never exits.
if (getGeoDb()) {
  const meta = datasetMeta();
  log.info("geoip datasets loaded", {
    builtAt: meta?.builtAt,
    dbipMonth: meta?.dbipMonth,
    sources: meta?.sources?.join(","),
  });
} else {
  log.warn(
    "geoip datasets missing — /api/info returns limited data. " +
      "Run: bun apps/api/scripts/fetch-datasets.ts",
  );
}

log.info("enrichment config", {
  routing: ENABLE_ROUTING,
  onlineTiebreaker: ENABLE_ONLINE_TIEBREAKER,
});

// Keep the Tor exit list warm (public list, carries no visitor IP). refreshTorExits
// self-throttles to hourly and logs its own outcome, so the interval is a cheap
// re-trigger.
void refreshTorExits();
const torTimer = setInterval(() => void refreshTorExits(), 60 * 60 * 1000);
torTimer.unref?.();

const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
const app = createApp({ proxySecret, enableRouting: ENABLE_ROUTING });

const server = Bun.serve({ port, fetch: app.fetch });
log.info("api listening", { url: `http://localhost:${server.port}` });

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    // Drain in-flight requests before exit.
    await server.stop();
    process.exit(0);
  });
}
