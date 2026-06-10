import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { createAppServer } from "../src/app.ts";

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
    const mainJs = await fetch(`${baseUrl}/js/main.js`);
    const css = await fetch(`${baseUrl}/styles.css`);

    assert.equal(index.status, 200);
    assert.equal(index.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(index.headers.get("cache-control"), "no-store");
    assert.match(await index.text(), /<script type="module" src="\/js\/main\.js"><\/script>/);

    assert.equal(mainJs.status, 200);
    assert.equal(mainJs.headers.get("content-type"), "text/javascript; charset=utf-8");
    assert.equal(mainJs.headers.get("cache-control"), "public, max-age=300");

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

test("api info uses first forwarded ip and returns normalised json", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return Response.json({
      ip: "203.0.113.10",
      location: { country: "Norway", country_code: "NO" },
      company: { name: "Telenor" },
      asn: { asn: 2119, org: "Telenor" },
    });
  };

  await withServer(fetchImpl, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/info`, {
      headers: { "x-forwarded-for": "203.0.113.10, 198.51.100.20" },
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), "*");
    const body = await response.json();
    assert.equal(body.status, "success");
    assert.equal(body.query, "203.0.113.10");
    assert.equal(body.country, "Norway");
    assert.equal(body.countryCode, "NO");
    assert.equal(body.isp, "Telenor");
    assert.match(calls[0], /\?q=203\.0\.113\.10$/);
  });
});

test("api info can look up an explicit detected ip", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    return Response.json({
      ip: "2001:db8::42",
      location: { country: "Norway", country_code: "NO" },
    });
  };

  await withServer(fetchImpl, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/info?ip=2001%3Adb8%3A%3A42`, {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "success");
    assert.equal(body.query, "2001:db8::42");
    assert.equal(body.country, "Norway");
    assert.match(calls[0], /\?q=2001%3Adb8%3A%3A42$/);
  });
});

test("api info reports failed upstream lookups as bad gateway", async () => {
  const fetchImpl = async () => Response.json({ error: "Invalid IP Address or AS Number" });

  await withServer(fetchImpl, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/api/info`);
    const body = await response.json();

    assert.equal(response.status, 502);
    assert.equal(body.error, "upstream_failed");
    assert.match(body.message, /Invalid IP Address/);
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

test("script.js proxies the umami tracker as a first-party asset", async () => {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    return new Response("(()=>{/* umami */})();", {
      headers: { "content-type": "application/javascript; charset=utf-8" },
    });
  };

  const server = createAppServer({
    fetchImpl,
    requestTimeoutMs: 100,
    umamiScriptUrl: "https://example.test/script.js",
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/script.js`);

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/javascript; charset=utf-8");
    assert.equal(response.headers.get("cache-control"), "public, max-age=3600");
    assert.match(await response.text(), /umami/);
    assert.deepEqual(calls, ["https://example.test/script.js"]);
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("api/send forwards the body and propagates the client IP to umami", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = init?.body ? Buffer.from(init.body).toString("utf-8") : "";
    calls.push({ url: String(url), method: init?.method, body, headers: init?.headers });
    return new Response('{"ok":true}', {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  const server = createAppServer({
    fetchImpl,
    requestTimeoutMs: 100,
    umamiSendUrl: "https://example.test/api/send",
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  try {
    const { port } = server.address();
    const payload = JSON.stringify({ type: "event", payload: { website: "abc" } });
    const response = await fetch(`http://127.0.0.1:${port}/api/send`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": "Mozilla/5.0 test",
        "x-forwarded-for": "203.0.113.10",
      },
      body: payload,
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://example.test/api/send");
    assert.equal(calls[0].method, "POST");
    assert.equal(calls[0].body, payload);
    assert.equal(calls[0].headers["User-Agent"], "Mozilla/5.0 test");
    assert.equal(calls[0].headers["X-Forwarded-For"], "203.0.113.10");
  } finally {
    server.close();
    await once(server, "close");
  }
});
