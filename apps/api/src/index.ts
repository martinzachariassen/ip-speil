#!/usr/bin/env bun
import { createApp, DEFAULT_PORT } from "./app.ts";
import { datasetMeta, getGeoDb } from "./geoip/load.ts";
import { refreshTorExits } from "./lib/tor.ts";

const proxySecret = process.env.PROXY_SECRET;
if (!proxySecret && process.env.NODE_ENV === "production") {
  // Fail closed: never boot the public API with the proxy gate disabled.
  console.error("PROXY_SECRET is required in production — it guards /api/info.");
  process.exit(1);
}

// Warm the local geoip datasets so the first request isn't slowed by the parse.
// Missing datasets degrade gracefully (limited /api/info), so this never exits.
if (getGeoDb()) {
  const meta = datasetMeta();
  console.log(`geoip datasets loaded${meta?.builtAt ? ` (built ${meta.builtAt})` : ""}`);
} else {
  console.warn(
    "geoip datasets missing — /api/info returns limited data. " +
      "Run: bun apps/api/scripts/fetch-datasets.ts",
  );
}

// Keep the Tor exit list warm (public list, carries no visitor IP). refreshTorExits
// self-throttles to hourly, so the interval is a cheap re-trigger.
void refreshTorExits();
const torTimer = setInterval(() => void refreshTorExits(), 60 * 60 * 1000);
torTimer.unref?.();

const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
const app = createApp({ proxySecret });

const server = Bun.serve({ port, fetch: app.fetch });
console.log(`▶  http://localhost:${server.port}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    // Drain in-flight requests before exit.
    await server.stop();
    process.exit(0);
  });
}
