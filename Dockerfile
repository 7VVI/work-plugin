FROM node:22-bookworm AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build:web

WORKDIR /app/server
RUN npm ci \
  && npm run build \
  && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production
ENV PORT=8080
ENV DOCK_DB=/data/dock.sqlite
ENV DOCK_WEB_DIST=/app/public
WORKDIR /app

COPY --from=build /app/server/dist ./server-dist
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/package.json ./server-package.json
COPY --from=build /app/dist-web ./public

RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server-dist/index.js"]
