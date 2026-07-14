#!/usr/bin/env bun
import { createApp, DEFAULT_PORT } from "./app.ts";

const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
const app = createApp();

const server = Bun.serve({ port, fetch: app.fetch });
console.log(`▶  http://localhost:${server.port}`);

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    // Drain in-flight requests before exit.
    await server.stop();
    process.exit(0);
  });
}
