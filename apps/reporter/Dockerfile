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

ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules

USER node

CMD ["node", "dist/main.js", "weekly"]
