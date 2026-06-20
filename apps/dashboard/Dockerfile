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

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN mkdir -p /app/.next/cache && chown -R node:node /app

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node

EXPOSE 3000
CMD ["node", "server.js"]
