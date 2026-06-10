FROM node:24-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

# Zero runtime dependencies → no `npm install`. Copy manifest + source only.
COPY package.json package-lock.json ./
COPY src ./src
COPY public ./public

RUN chown -R app:app /app
USER app

ENV PORT=3000
EXPOSE 3000

# Node 24 runs the TypeScript entry point directly via native type-stripping — no build step.
CMD ["node", "src/server.ts"]
