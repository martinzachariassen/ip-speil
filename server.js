#!/usr/bin/env node
// @ts-check
import { createAppServer, DEFAULT_PORT } from "./src/server.js";

const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
const server = createAppServer();

server.listen(port, () => {
  console.log(`▶  http://localhost:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}
