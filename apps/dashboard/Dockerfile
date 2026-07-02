FROM node:24.17.0-alpine AS build
WORKDIR /app
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:24.17.0-alpine
WORKDIR /app
ARG APP_COMMIT_SHA=unknown
ARG BUILD_COMMIT=unknown
ARG BUILD_DATE=unknown

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV APP_COMMIT_SHA=${APP_COMMIT_SHA}
ENV BUILD_COMMIT=${BUILD_COMMIT}
ENV BUILD_DATE=${BUILD_DATE}
LABEL org.opencontainers.image.revision=${APP_COMMIT_SHA}
LABEL org.opencontainers.image.created=${BUILD_DATE}

RUN mkdir -p /app/.next/cache && chown -R node:node /app

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./app/.next/static
COPY --from=build --chown=node:node /app/public ./app/public
USER node

EXPOSE 3000
CMD ["node", "app/server.js"]
