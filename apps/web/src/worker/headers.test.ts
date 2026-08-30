import { expect, test } from "bun:test";

import { echoHeaders } from "./headers.ts";

async function echo(headers: Record<string, string>): Promise<Record<string, string>> {
  const res = echoHeaders(new Request("https://ip.mlz.no/api/headers", { headers }));
  expect(res.headers.get("cache-control")).toBe("no-store");
  return (await res.json()) as Record<string, string>;
}

test("echoes what the browser sent, lowercased", async () => {
  const body = await echo({ "User-Agent": "Mozilla/5.0 (probe)", "Accept-Language": "nb-NO" });

  expect(body["user-agent"]).toBe("Mozilla/5.0 (probe)");
  expect(body["accept-language"]).toBe("nb-NO");
});

test("drops hop-by-hop headers", async () => {
  const body = await echo({ "user-agent": "probe", te: "trailers", upgrade: "websocket" });

  expect(Object.keys(body)).toEqual(["user-agent"]);
});

// Cloudflare sets __cf_bm on managed zones, so a visitor arrives with a cookie
// even though this app never sets one. Reporting the header is the point;
// printing the token on a page made to be screenshotted is not.
test("reports a cookie header without printing the token", async () => {
  const body = await echo({ cookie: "__cf_bm=abcdef123456; other=xyz" });

  expect(body.cookie).toBe("[hidden — 31 chars]");
  expect(body.cookie).not.toContain("abcdef123456");
});

test("masks an authorization header the same way", async () => {
  const body = await echo({ authorization: "Bearer sk-secret-token" });

  expect(body.authorization).toBe("[hidden — 22 chars]");
  expect(body.authorization).not.toContain("sk-secret-token");
});
