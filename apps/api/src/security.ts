import { secureHeaders } from "hono/secure-headers";

// The API only serves JSON now. The page CSP (script-src, connect-src, fonts,
// …) lives in the web app's Cloudflare `_headers` file; here we keep the
// transport/typing hardening that still makes sense on API responses.
export const securityMiddleware = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'none'"],
    frameAncestors: ["'none'"],
  },
  crossOriginOpenerPolicy: "same-origin",
  crossOriginResourcePolicy: "same-origin",
  crossOriginEmbedderPolicy: false,
  referrerPolicy: "no-referrer",
  strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
  xContentTypeOptions: "nosniff",
  xFrameOptions: "DENY",
  permissionsPolicy: { browsingTopics: [] },
});
