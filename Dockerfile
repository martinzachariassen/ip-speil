FROM node:22-alpine

RUN addgroup -S app && adduser -S app -G app

WORKDIR /app

COPY package.json server.js ./

RUN chown -R app:app /app
USER app

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
