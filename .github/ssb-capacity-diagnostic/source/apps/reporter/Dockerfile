FROM node:24.17.0-alpine AS build
WORKDIR /app
ENV CI=true

COPY apps/reporter/package.json apps/reporter/package-lock.json ./
RUN npm ci

COPY apps/reporter/ .
COPY apps/api/src/maintenance/maintenance-state.ts /api/src/maintenance/maintenance-state.ts
RUN npm run build
RUN npm prune --omit=dev

FROM node:24.17.0-alpine
WORKDIR /app

ENV NODE_ENV=production
LABEL com.ssb.maintenance-protocol="2"
LABEL com.ssb.reporter-lifecycle="1"

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

USER node
ENTRYPOINT []

CMD ["node", "dist/main.js", "weekly"]
