import { expect, test } from "bun:test";

import { plainIp, wantsPlainText } from "./cli.ts";

const req = (headers: Record<string, string>) => new Request("https://ip.mlz.no/", { headers });

test("a browser gets the page, never the plain-text IP", () => {
  expect(
    wantsPlainText(
      req({
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "user-agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
      }),
    ),
  ).toBe(false);
});

test("curl and friends get plain text", () => {
  const uas = [
    "curl/8.7.1",
    "Wget/1.21.4",
    "python-requests/2.32.3",
    "Go-http-client/2.0",
    "HTTPie/3.2.2",
  ];

  for (const ua of uas) {
    expect(wantsPlainText(req({ accept: "*/*", "user-agent": ua }))).toBe(true);
  }
});

test("an explicit text/plain wins regardless of the tool", () => {
  expect(wantsPlainText(req({ accept: "text/plain", "user-agent": "anything" }))).toBe(true);
});

// text/html is checked first on purpose: a browser that also sends a matching
// UA substring must still get the page.
test("text/html beats a CLI-looking user-agent", () => {
  expect(wantsPlainText(req({ accept: "text/html", "user-agent": "curl/8.7.1" }))).toBe(false);
});

test("an unrecognised client gets the page", () => {
  expect(wantsPlainText(req({ accept: "*/*", "user-agent": "SomeBot/1.0" }))).toBe(false);
  expect(wantsPlainText(req({}))).toBe(false);
});

test("plainIp answers with the bare address and nothing cacheable", async () => {
  const res = plainIp(req({ "cf-connecting-ip": "203.0.113.10" }));

  expect(await res.text()).toBe("203.0.113.10\n");
  expect(res.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  expect(res.headers.get("cache-control")).toBe("no-store");
});

test("plainIp degrades to an empty line when Cloudflare sent no address", async () => {
  expect(await plainIp(req({})).text()).toBe("\n");
});
