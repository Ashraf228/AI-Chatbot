FROM node:24.17.0-alpine AS build
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:24.17.0-alpine
WORKDIR /app
ARG APP_COMMIT_SHA=unknown
ARG BUILD_COMMIT=unknown
ARG BUILD_DATE=unknown
ENV NODE_ENV=production
ENV APP_COMMIT_SHA=${APP_COMMIT_SHA}
ENV BUILD_COMMIT=${BUILD_COMMIT}
ENV BUILD_DATE=${BUILD_DATE}
LABEL org.opencontainers.image.revision=${APP_COMMIT_SHA}
LABEL org.opencontainers.image.created=${BUILD_DATE}
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
USER node
EXPOSE 5000
CMD ["node", "dist/main.js"]
