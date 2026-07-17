FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat wget
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ── Development ─────────────────────────────────────
FROM base AS development
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["next", "dev"]

# ── Builder ──────────────────────────────────────────
FROM base AS builder
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
WORKDIR /app/apps/web
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm run build

# ── Production ───────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat wget
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
