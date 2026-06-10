#!/usr/bin/env node
import { createAppServer, DEFAULT_PORT } from "./app.ts";

const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
const server = createAppServer();

server.listen(port, () => {
  console.log(`▶  http://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
