# syntax=docker/dockerfile:1

# ── Install deps ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
# libc6-compat: Alpine glibc shim for native modules
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
RUN npm install -g corepack@latest && corepack enable pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# scripts/ and prisma/ must be present before pnpm install so the lifecycle
# hooks (postinstall: patch-next-build.cjs, prepare: prisma generate) work.
COPY scripts/ ./scripts/
COPY prisma/ ./prisma/
RUN pnpm install --no-frozen-lockfile

# ── Build the selected service ────────────────────────────────────────────────
FROM deps AS builder

# Limit Next.js static-generation workers to avoid OOM during "Collecting page data"
ENV NEXT_PRIVATE_CPUS=4

# Next.js bakes NEXT_PUBLIC_* into the client bundle at build time.
# These are public values — safe to pass as ARG. Secrets must never appear here.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_PAYPAL_CLIENT_ID
ARG NEXT_PUBLIC_GA_ID
ARG NEXT_PUBLIC_GTM_ID
ARG NEXT_PUBLIC_META_PIXEL_ID
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ARG NEXT_PUBLIC_SENTRY_DSN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_PAYPAL_CLIENT_ID=$NEXT_PUBLIC_PAYPAL_CLIENT_ID \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN

ARG SERVICE
ENV SERVICE=$SERVICE

COPY . .
RUN node railway-build.mjs
# Ensure all dist dirs exist so runner COPY never fails regardless of service
RUN mkdir -p dist/apps/api dist/apps/client dist/apps/admin

# ── Production image ──────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat wget
RUN npm install -g corepack@latest && corepack enable pnpm
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 appuser

COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder --chown=appuser:nodejs /app/prisma ./prisma
COPY --from=builder --chown=appuser:nodejs /app/railway-start.mjs ./

USER appuser
EXPOSE 3000 3001 3002
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:${PORT:-3002}/api/v1/health 2>/dev/null \
   || wget -qO- http://localhost:${PORT:-3000}/api/health 2>/dev/null \
   || exit 1
CMD ["node", "railway-start.mjs"]
