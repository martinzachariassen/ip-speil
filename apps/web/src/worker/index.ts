import { echoHeaders } from "./headers.ts";
import { proxyInfo } from "./proxy.ts";
import { umamiScript, umamiSend } from "./umami.ts";

export interface Env {
  // Static assets binding (serves ./public).
  ASSETS: Fetcher;
  // Origin of the Railway API, e.g. https://api.ip.mlz.no
  API_ORIGIN: string;
  // Shared token attached to proxied /api/info calls (set via `wrangler secret`).
  PROXY_SECRET: string;
  UMAMI_SCRIPT_URL: string;
  UMAMI_SEND_URL: string;
}

// Same-origin front door. The Worker owns the dynamic routes and hands
// everything else to the static-asset server.
export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    switch (pathname) {
      case "/api/headers":
        return echoHeaders(request);
      case "/api/info":
        return proxyInfo(request, env);
      case "/script.js":
        return umamiScript(env);
      case "/api/send":
        return request.method === "POST"
          ? umamiSend(request, env)
          : new Response("Method Not Allowed", { status: 405 });
      default:
        return env.ASSETS.fetch(request);
    }
  },
} satisfies ExportedHandler<Env>;
