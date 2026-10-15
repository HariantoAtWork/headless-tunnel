FROM oven/bun:canary-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV TUNNEL_PORT=9382
ENV TUNNEL_HOST=0.0.0.0

COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

COPY server.mjs rewrite.mjs ./

EXPOSE 9382

CMD ["bun", "run", "server.mjs"]
