FROM node:24-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY package.json package-lock.json server.js ./
COPY src ./src
COPY public ./public

RUN chown -R app:app /app
USER app

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
