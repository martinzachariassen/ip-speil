# API-only image for Railway. No client build step lives here anymore — the
# frontend ships to Cloudflare. Build context is the REPO ROOT (see
# railway.json `dockerfilePath`) so the workspace install can resolve.
FROM oven/bun:1-alpine
WORKDIR /app
ENV NODE_ENV=production

# Manifests first for layer caching. All workspace manifests are needed so the
# workspace graph resolves, even though only the API ships in this image.
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json

# --production drops devDependencies (Wrangler, tsc, Biome, @types/bun).
RUN bun install --frozen-lockfile --production

# Runtime source. @ip-speil/shared is type-only at runtime, but copy it so the
# workspace symlink target exists.
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# oven/bun ships a non-root `bun` user.
USER bun

ENV PORT=3000
EXPOSE 3000

# Bun runs the TypeScript entry point directly (transpile-on-load) — no build step.
CMD ["bun", "apps/api/src/index.ts"]
