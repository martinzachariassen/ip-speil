#!/usr/bin/env bun
import { createApp, DEFAULT_PORT } from "./app.ts";

const proxySecret = process.env.PROXY_SECRET;
if (!proxySecret && process.env.NODE_ENV === "production") {
  // Fail closed: never boot the public API with the proxy gate disabled.
  console.error("PROXY_SECRET is required in production — it guards /api/info.");
  process.exit(1);
}

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
