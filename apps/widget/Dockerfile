FROM node:20-alpine AS widget-build
WORKDIR /app/apps/widget

COPY apps/widget/package.json apps/widget/package-lock.json* ./
RUN npm ci

COPY apps/widget ./
RUN npm run build

FROM node:20-alpine AS loader-build
WORKDIR /app/packages/widget-sdk

COPY packages/widget-sdk/package.json ./
RUN npm install

COPY packages/widget-sdk ./
RUN npm run build

FROM nginx:alpine
COPY apps/widget/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=widget-build /app/apps/widget/dist/widget.js /usr/share/nginx/html/widget.js
COPY --from=loader-build /app/packages/widget-sdk/dist/loader.js /usr/share/nginx/html/loader.js
EXPOSE 80
