FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS development
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/
WORKDIR /app/apps/worker
CMD ["node", "-r", "ts-node/register", "src/index.ts"]

FROM base AS builder
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY apps/worker/package.json ./apps/worker/
RUN pnpm install --frozen-lockfile
COPY packages/ ./packages/
COPY apps/worker/ ./apps/worker/
WORKDIR /app/apps/worker
RUN pnpm run build

FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/apps/worker/package.json ./
RUN npm install --omit=dev
CMD ["node", "dist/index.js"]
