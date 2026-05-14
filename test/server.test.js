import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { createAppServer } from "../src/server.js";

async function withServer(fetchImpl, callback) {
  const server = createAppServer({ fetchImpl, requestTimeoutMs: 100 });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address();
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("health endpoint returns ok with security headers", async () => {
  await withServer(fetch, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`);

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "ok");
    assert.doesNotMatch(response.headers.get("content-security-policy"), /unsafe-inline/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  });
});

test("serves public index and static assets with appropriate cache headers", async () => {
  await withServer(fetch, async (baseUrl) => {
    const index = await fetch(`${baseUrl}/`);
    const app = await fetch(`${baseUrl}/app.js`);
    const css = await fetch(`${baseUrl}/styles.css`);

    assert.equal(index.status, 200);
    assert.equal(index.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(index.headers.get("cache-control"), "no-store");
    assert.match(await index.text(), /<script src="\/app\.js" defer><\/script>/);

    assert.equal(app.status, 200);
    assert.equal(app.headers.get("content-type"), "text/javascript; charset=utf-8");
    assert.equal(app.headers.get("cache-control"), "public, max-age=300");

    assert.equal(css.status, 200);
    assert.equal(css.headers.get("content-type"), "text/css; charset=utf-8");
    assert.equal(css.headers.get("cache-control"), "public, max-age=300");
  });
});

test("does not serve unknown public paths", async () => {
  await withServer(fetch, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/../server.js`);

    assert.equal(response.status, 404);
    assert.equal(await response.text(), "Not found");
  });
});

test("api info uses first forwarded ip and returns upstream json", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return Response.json({
      status: "success",
      query: "203.0.113.10",
      country: "Norway",
    });
  };

  await withServer(fetchImpl, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/info`, {
      headers: { "x-forwarded-for": "203.0.113.10, 198.51.100.20" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    assert.deepEqual(await response.json(), {
      status: "success",
      query: "203.0.113.10",
      country: "Norway",
    });
    assert.match(calls[0], /\/json\/203\.0\.113\.10\?/);
  });
});

test("api info can look up an explicit detected ip", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return Response.json({
      status: "success",
      query: "2001:db8::42",
      country: "Norway",
    });
  };

  await withServer(fetchImpl, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/info?ip=2001%3Adb8%3A%3A42`, {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "success",
      query: "2001:db8::42",
      country: "Norway",
    });
    assert.match(calls[0], /\/json\/2001%3Adb8%3A%3A42\?/);
  });
});

test("api info reports failed upstream lookups as bad gateway", async () => {
  const fetchImpl = async () => Response.json({ status: "fail", message: "invalid query" });

  await withServer(fetchImpl, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/info`);
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(body.error, "upstream_failed");
    assert.equal(body.message, "invalid query");
  });
});

test("headers endpoint hides hop-by-hop headers", async () => {
  await withServer(fetch, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/headers`, {
      headers: {
        "x-visible": "yes",
        "x-real-ip": "203.0.113.10",
      },
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body["x-visible"], "yes");
    assert.equal(body.host, undefined);
    assert.equal(body.connection, undefined);
  });
});

test("unsupported methods return 405", async () => {
  await withServer(fetch, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/health`, { method: "POST" });

    assert.equal(response.status, 405);
    assert.equal(response.headers.get("allow"), "GET, HEAD");
    assert.deepEqual(await response.json(), { error: "method_not_allowed" });
  });
});
