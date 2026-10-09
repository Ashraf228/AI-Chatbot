FROM node@sha256:156b55f92e98ccd5ef49578a8cea0df4679826564bad1c9d4ef04462b9f0ded6 AS build
WORKDIR /app
ENV CI=true
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node@sha256:156b55f92e98ccd5ef49578a8cea0df4679826564bad1c9d4ef04462b9f0ded6
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
LABEL com.ssb.maintenance-protocol="2"
LABEL com.ssb.shutdown-protocol="1"
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
USER node
ENTRYPOINT []
EXPOSE 5000
CMD ["node", "dist/main.js"]
