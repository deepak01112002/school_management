# ── Base ────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl wget
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY packages/config/package.json ./packages/config/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY apps/api/package.json ./apps/api/

# ── Development ─────────────────────────────────────
FROM base AS development
RUN pnpm install --frozen-lockfile
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
WORKDIR /app/apps/api
RUN npx prisma generate
EXPOSE 3001 9229
CMD ["node_modules/.bin/nest", "start", "--watch", "--debug", "0.0.0.0:9229"]

# ── Builder ──────────────────────────────────────────
FROM base AS builder
RUN pnpm install --frozen-lockfile
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
WORKDIR /app/apps/api
RUN npx prisma generate
RUN pnpm run build

# ── Production ───────────────────────────────────────
FROM node:20-alpine AS production
RUN apk add --no-cache libc6-compat openssl wget
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY --from=builder /app/apps/api/package.json ./
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
RUN pnpm install --prod --frozen-lockfile --ignore-scripts 2>/dev/null || true

EXPOSE 3001
CMD ["node", "dist/main"]
