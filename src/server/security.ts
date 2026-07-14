import { secureHeaders } from "hono/secure-headers";

import { CLIENT_CONNECT_SRC } from "./config.ts";

export const securityMiddleware = secureHeaders({
  contentSecurityPolicy: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],
    connectSrc: [...CLIENT_CONNECT_SRC],
    imgSrc: ["'self'", "data:"],
    styleSrc: ["'self'"],
    fontSrc: ["'self'"],
    baseUri: ["'none'"],
    formAction: ["'none'"],
    frameAncestors: ["'none'"],
  },
  crossOriginOpenerPolicy: "same-origin",
  crossOriginResourcePolicy: "same-origin",
  // Leave COEP off — enabling it would break the cross-origin probe fetches.
  crossOriginEmbedderPolicy: false,
  referrerPolicy: "no-referrer",
  strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
  xContentTypeOptions: "nosniff",
  xFrameOptions: "DENY",
  permissionsPolicy: { browsingTopics: [] },
});
