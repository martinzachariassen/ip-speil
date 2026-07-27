import type { Env } from "./index.ts";

// Server-to-server call to the Railway API. We attach the shared token here at
// the edge — it is never sent to the browser — so the public Railway URL can't
// be used to burn our ipapi.is quota directly. The visitor's real IP rides along
// as X-Forwarded-For so the API's per-IP rate limiter keys on the right client.
export async function proxyInfo(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const target = `${env.API_ORIGIN}/api/info${url.search}`;

  const headers = new Headers();
  headers.set("authorization", `Bearer ${env.PROXY_SECRET}`);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);

  const upstream = await fetch(target, { headers });
  const res = new Response(upstream.body, upstream);
  res.headers.set("cache-control", "no-store");
  return res;
}
