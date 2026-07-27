import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The web app is a Cloudflare Worker with static assets: the Worker owns the
// dynamic routes (/api/*, /script.js, content-negotiated /) and falls through to
// the Vite-built SPA for everything else. `@cloudflare/vite-plugin` runs that
// Worker in workerd during `vite dev` (so the API proxy works with HMR) and, on
// build, emits the client bundle plus a generated wrangler.json whose
// `assets.directory` already points at the client output — so `wrangler deploy`
// after `vite build` needs no extra flags.
export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
  build: {
    target: "es2022",
    // Content-hashed output lands in dist/bundle/ instead of dist/assets/, so it
    // never collides with the stable-URL files copied from public/assets/ and can
    // be marked immutable in public/_headers without freezing a favicon.
    assetsDir: "bundle",
    // No inline module-preload polyfill → the built HTML carries no inline
    // <script>, keeping the page CSP's script-src at a strict 'self'.
    modulePreload: { polyfill: false },
  },
});
