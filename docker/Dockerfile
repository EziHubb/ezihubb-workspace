# syntax=docker/dockerfile:1
#
# Single Dockerfile, one target per deployable service (docker-compose.yml
# selects via `target:`) — api / client / admin / migrate. All four share
# the same `base` (deps installed once) and `source` (full monorepo copy,
# no build) stages, so the pnpm-store and Nx-cache mounts below are reused
# across every service instead of each maintaining its own copy of the
# install step.

# ============================================
# Base — install all workspace deps once
# ============================================
FROM node:22-alpine AS base
# python3/make/g++/pkgconf + cairo/pango/jpeg/gif libs: required to compile
# canvas (pulled in by jsdom → vitest; no pre-built musl binary for Node 22)
RUN apk add --no-cache \
    libc6-compat \
    python3 \
    make \
    g++ \
    pkgconf \
    cairo-dev \
    pango-dev \
    libjpeg-turbo-dev \
    giflib-dev \
    pixman-dev \
    fontconfig-dev
WORKDIR /app
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# scripts/, prisma/ and prisma.config.ts must be present before pnpm install
# so the lifecycle hooks (postinstall: patch-next-build.cjs, prepare: prisma
# generate) work.
COPY scripts/ ./scripts/
COPY prisma/ ./prisma/
COPY prisma.config.ts ./
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# ============================================
# Source — full monorepo source, no build. Shared by every per-app builder
# stage below and by `migrate` (prisma migrate deploy needs source+deps but
# never a built app) — migrate must never depend on a stage that builds an
# unrelated app.
# ============================================
FROM base AS source
COPY . .

# ============================================
# One builder stage per deployable app
# ============================================
FROM source AS builder-api
RUN pnpm exec prisma generate --schema=prisma/schema.prisma
RUN --mount=type=cache,id=nx-cache,target=/app/.nx/cache \
    pnpm nx build api --configuration=production

FROM source AS builder-client
# NEXT_PUBLIC_* vars are inlined into the client bundle at BUILD time — must
# be passed as build ARGs (docker-compose.yml's build.args:), not runtime
# environment: — runtime env has no effect on an already-built bundle.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_NEXTAUTH_URL
ARG NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_PAYPAL_CLIENT_ID
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_GTM_ID
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_NEXTAUTH_URL=$NEXT_PUBLIC_NEXTAUTH_URL \
    NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_PAYPAL_CLIENT_ID=$NEXT_PUBLIC_PAYPAL_CLIENT_ID \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
RUN --mount=type=cache,id=nx-cache,target=/app/.nx/cache \
    pnpm nx build client --configuration=production

FROM source AS builder-admin
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_NEXTAUTH_URL
ARG NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_NEXTAUTH_URL=$NEXT_PUBLIC_NEXTAUTH_URL \
    NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN
RUN --mount=type=cache,id=nx-cache,target=/app/.nx/cache \
    pnpm nx build admin --configuration=production

# ============================================
# Production stages — copy only the built output, not source
# ============================================
FROM node:22-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder-api --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder-api --chown=nestjs:nodejs /app/dist/apps/api ./dist
COPY --from=builder-api --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=builder-api --chown=nestjs:nodejs /app/package.json ./package.json
USER nestjs
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3002/api/v1/health || exit 1
CMD ["node", "dist/main.js"]

FROM node:22-alpine AS client
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder-client --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder-client --chown=nextjs:nodejs /app/dist/apps/client ./dist/apps/client
COPY --from=builder-client --chown=nextjs:nodejs /app/package.json ./package.json
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node_modules/.bin/next", "start", "dist/apps/client", "--port", "3000"]

FROM node:22-alpine AS admin
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder-admin --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder-admin --chown=nextjs:nodejs /app/dist/apps/admin ./dist/apps/admin
COPY --from=builder-admin --chown=nextjs:nodejs /app/package.json ./package.json
USER nextjs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1
CMD ["node_modules/.bin/next", "start", "dist/apps/admin", "--port", "3001"]

# ============================================
# Migrate — targets `source`, never a per-app builder stage, so running
# migrations never forces an unrelated app to build.
# ============================================
FROM source AS migrate
CMD ["node_modules/.bin/prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"]
