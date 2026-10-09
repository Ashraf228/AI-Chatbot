FROM node@sha256:156b55f92e98ccd5ef49578a8cea0df4679826564bad1c9d4ef04462b9f0ded6 AS widget-build
WORKDIR /app/apps/widget
ENV CI=true

COPY apps/widget/package.json apps/widget/package-lock.json* ./
RUN npm ci

COPY apps/widget ./
COPY packages/widget-sdk/src/runtime-config.ts /app/packages/widget-sdk/src/runtime-config.ts
RUN npm run build

FROM node@sha256:156b55f92e98ccd5ef49578a8cea0df4679826564bad1c9d4ef04462b9f0ded6 AS loader-build
WORKDIR /app/packages/widget-sdk
ENV CI=true

COPY packages/widget-sdk/package.json packages/widget-sdk/package-lock.json* ./
RUN npm ci

COPY packages/widget-sdk ./
RUN npm run build

FROM nginx@sha256:582c496ccf79d8aa6f8203a79d32aaf7ffd8b13362c60a701a2f9ac64886c93d
ARG APP_COMMIT_SHA=unknown
ARG BUILD_COMMIT=unknown
ARG BUILD_DATE=unknown
ENV APP_COMMIT_SHA=${APP_COMMIT_SHA}
ENV BUILD_COMMIT=${BUILD_COMMIT}
ENV BUILD_DATE=${BUILD_DATE}
LABEL org.opencontainers.image.revision=${APP_COMMIT_SHA}
LABEL org.opencontainers.image.created=${BUILD_DATE}
COPY apps/widget/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=widget-build /app/apps/widget/dist/widget.js /usr/share/nginx/html/widget.js
COPY --from=loader-build /app/packages/widget-sdk/dist/loader.js /usr/share/nginx/html/loader.js
RUN printf '{"ok":true,"service":"widget","commit":"%s","buildTime":"%s"}\n' "$APP_COMMIT_SHA" "$BUILD_DATE" > /usr/share/nginx/html/version.json
EXPOSE 80
