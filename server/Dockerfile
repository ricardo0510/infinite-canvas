# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
# Prisma 需要在 generate 时识别到 OpenSSL 3，否则会生成 openssl-1.1.x 引擎。
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
# Prisma 的 postinstall 需要 schema，先生成依赖，再单独 generate。
RUN npm ci --ignore-scripts
COPY prisma ./prisma
RUN npx prisma generate

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# 保留 devDependencies，便于在容器内执行 prisma db seed / migrate。
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY package.json package-lock.json ./

EXPOSE 8790 8791
CMD ["node", "dist/main.js"]
