import { access, stat } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";

const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SCREENSHOT = "/private/tmp/ip-speil-smoke.png";

const chromeCandidates = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "google-chrome",
  "chromium",
];

async function findChrome() {
  for (const candidate of chromeCandidates) {
    try {
      if (candidate.startsWith("/")) await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next common executable path.
    }
  }
  throw new Error("No Chrome or Chromium executable found for browser smoke test");
}

async function waitForHealth() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE_URL}/health`);
      if (response.ok && await response.text() === "ok") return;
    } catch {
      // Server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Timed out waiting for smoke-test server");
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", ...options });
    child.on("error", reject);
    child.on("exit", code => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with ${code}`));
    });
  });
}

const server = spawn(process.execPath, ["server.js"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, PORT: String(PORT) },
  stdio: "inherit",
});

try {
  server.on("error", err => { throw err; });
  await waitForHealth();

  const chrome = await findChrome();
  await run(chrome, [
    "--headless",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--screenshot=${SCREENSHOT}`,
    "--window-size=390,844",
    BASE_URL,
  ]);

  const screenshot = await stat(SCREENSHOT);
  if (screenshot.size < 10_000) {
    throw new Error(`Smoke screenshot is unexpectedly small: ${screenshot.size} bytes`);
  }
} finally {
  server.kill("SIGTERM");
  try {
    await once(server, "exit");
  } catch {
    // The process may already be gone if startup failed.
  }
}
