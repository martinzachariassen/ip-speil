import type { Env } from "./index.ts";

// First-party proxy of the Umami tracker script. Same-origin keeps it out of
// adblock lists; Cloudflare's cache holds the upstream copy.
export async function umamiScript(env: Env): Promise<Response> {
  const upstream = await fetch(env.UMAMI_SCRIPT_URL, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  const res = new Response(upstream.body, upstream);
  res.headers.set("cache-control", "public, max-age=3600");
  return res;
}

// Forward analytics events to Umami, passing the visitor's real IP + UA so the
// stats stay accurate without exposing the browser to a third-party origin.
export async function umamiSend(request: Request, env: Env): Promise<Response> {
  const headers = new Headers();
  headers.set("content-type", request.headers.get("content-type") ?? "application/json");
  const ua = request.headers.get("user-agent");
  if (ua) headers.set("user-agent", ua);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) headers.set("x-forwarded-for", ip);

  const upstream = await fetch(env.UMAMI_SEND_URL, {
    method: "POST",
    headers,
    body: await request.arrayBuffer(),
  });
  const res = new Response(upstream.body, upstream);
  res.headers.set("cache-control", "no-store");
  return res;
}
