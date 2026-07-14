# --- Build stage: bundle the client TypeScript to public/js ---------------
FROM oven/bun:1-alpine AS build
WORKDIR /app

# The client bundle has no npm dependencies, so no install is needed here.
COPY src ./src
COPY public ./public
RUN bun build src/client/main.ts --outdir public/assets/js --target browser --minify --sourcemap=linked

# --- Runtime stage --------------------------------------------------------
FROM oven/bun:1-alpine
WORKDIR /app
ENV NODE_ENV=production

# Install runtime deps only (Hono). Dev tooling stays out of the image.
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY --from=build /app/public ./public

# oven/bun ships a non-root `bun` user.
USER bun

ENV PORT=3000
EXPOSE 3000

# Bun runs the TypeScript entry point directly (transpile-on-load) — no build step.
CMD ["bun", "src/server/index.ts"]
