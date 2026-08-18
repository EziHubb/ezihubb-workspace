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
# node:24 (LTS), not 22 — Node 22's stream/web TransformStream has an
# unpatched race condition (nodejs/node#62036, fixed by #62040, landed in
# v24.15.0/v25.8.1, not backported to the 22.x line) where a reader being
# cancelled mid-write throws an internal `TypeError:
# controller[kState].transformAlgorithm is not a function` and leaves the
# server unable to accept further connections. Next.js's App Router
# streams SSR/RSC responses through TransformStream heavily, so any client
# that aborts a request mid-response (a slow/truncated read, a real
# browser navigating away, a health-check that doesn't read the full body)
# can trigger it — reproduced in production on client/admin under 22 and
# gone after this bump.
FROM node:24-alpine AS base
# python3/make/g++/pkgconf: kept as a general node-gyp fallback for any
# native dep (e.g. bcrypt) that doesn't ship a musl/Alpine prebuilt binary
# for the current Node version — most (bcrypt included, via `prebuildify
# --tag-libc`) do ship one and skip compiling entirely, but this is cheap
# insurance against a silent install failure if one ever doesn't.
# cairo/pango/jpeg/gif/pixman/fontconfig-dev were ONLY here to compile
# `canvas` (pulled in transitively by jest-environment-jsdom, test-only —
# no app code imports it) — now aliased to an empty stub via
# pnpm-workspace.yaml's `overrides`, so pnpm never tries to build the real
# package and these libs are no longer needed at all.
RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
    apk add \
    libc6-compat \
    python3 \
    make \
    g++ \
    pkgconf
WORKDIR /app
# Pinned via corepack (not `npm install -g pnpm`) so the version always
# matches package.json's "packageManager" field exactly — faster than an npm
# global install, and avoids a cache miss the moment pnpm ships an update.
RUN corepack enable && corepack prepare pnpm@11.5.2 --activate
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# Only the 3 scripts actually invoked by package.json's install lifecycle
# (postinstall/prepare/build) — NOT the whole scripts/ dir. deploy.sh,
# smoke-test.sh, nginx-ezihubb.conf, etc. never run inside the image, so
# copying them here would invalidate this layer (and every downstream
# build stage) on unrelated local-tooling edits. Deliberately NOT copying
# prisma/ or prisma.config.ts here: this layer must only invalidate when
# package.json/pnpm-lock.yaml actually change, not on every prisma schema
# edit, since installing deps is the heaviest, slowest step in the whole
# build.
COPY scripts/patch-next-build.cjs scripts/prisma-generate-if-present.cjs scripts/postbuild.mjs ./scripts/
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
# Explicit generate call — prisma/ wasn't present during `pnpm install`
# above, so the prepare hook no-op'd. This is the one place it actually runs
# for the Docker build, shared by every stage below via `FROM source`.
# Direct binary path (not `pnpm exec`, which re-runs postinstall/prepare as
# part of its own install-consistency check — generating twice for nothing).
RUN ./node_modules/.bin/prisma generate --schema=prisma/schema.prisma

# ============================================
# One builder stage per deployable app
# ============================================
FROM source AS builder-api
RUN --mount=type=cache,id=nx-cache,target=/app/.nx/cache \
    pnpm nx build api --configuration=production
# Strips devDependencies (jest, typescript, nx, eslint, @playwright/test,
# testing-library, etc. — ~half the workspace's package count) from this
# stage's node_modules before the production stage copies it wholesale.
# Safe for api specifically: dist/main.js only ever needs @prisma/client
# (a real dependency, already generated above) programmatically, never the
# `prisma` CLI binary itself — unlike the `migrate` stage below, which
# genuinely invokes `prisma` the CLI at runtime and must NOT be pruned.
# --config.confirmModulesPurge=false — pnpm's accidental-data-loss guard
# refuses to remove node_modules without a TTY to confirm against, which a
# Docker RUN step never has (surfaced as ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY).
# --ignore-scripts — pruning otherwise re-fires the root `prepare` lifecycle
# script (package.json), which shells out to `pnpm exec prisma generate`;
# by the time prune gets to it the `prisma` devDependency it needs is
# already stripped, so it fails. Unnecessary anyway — `source`'s own
# `prisma generate` call above already ran once, shared by this stage via
# `FROM source`, and pruning only removes packages, not that generated
# @prisma/client output.
RUN pnpm prune --prod --config.confirmModulesPurge=false --ignore-scripts

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
ARG NEXT_PUBLIC_PINTEREST_TAG_ID
ARG NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_NEXTAUTH_URL=$NEXT_PUBLIC_NEXTAUTH_URL \
    NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_PAYPAL_CLIENT_ID=$NEXT_PUBLIC_PAYPAL_CLIENT_ID \
    NEXT_PUBLIC_GA_ID=$NEXT_PUBLIC_GA_ID \
    NEXT_PUBLIC_GTM_ID=$NEXT_PUBLIC_GTM_ID \
    NEXT_PUBLIC_META_PIXEL_ID=$NEXT_PUBLIC_META_PIXEL_ID \
    NEXT_PUBLIC_PINTEREST_TAG_ID=$NEXT_PUBLIC_PINTEREST_TAG_ID \
    NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=$NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
RUN --mount=type=cache,id=nx-cache,target=/app/.nx/cache \
    pnpm nx build client --configuration=production

FROM source AS builder-admin
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_NEXTAUTH_URL
ARG NEXT_PUBLIC_CDN_URL
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_CLIENT_URL
ARG NEXT_PUBLIC_GA_DASHBOARD_URL
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
# The git SHA this image was built from — baked in at build time (inlined
# into the client bundle like every other NEXT_PUBLIC_* var above) so a
# SUPER_ADMIN can visually confirm which commit is actually live in
# production without SSHing in. Set by CI (docker-publish.yml, github.sha)
# and by deploy.sh's local-build fallback (docker-compose.yml, GIT_SHA) —
# see CLAUDE.md "Build version" for the full wiring. Defaults to "dev" for
# a plain `nx serve admin` where no build arg is passed.
ARG NEXT_PUBLIC_BUILD_VERSION=dev
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_NEXTAUTH_URL=$NEXT_PUBLIC_NEXTAUTH_URL \
    NEXT_PUBLIC_CDN_URL=$NEXT_PUBLIC_CDN_URL \
    NEXT_PUBLIC_SENTRY_DSN=$NEXT_PUBLIC_SENTRY_DSN \
    NEXT_PUBLIC_CLIENT_URL=$NEXT_PUBLIC_CLIENT_URL \
    NEXT_PUBLIC_GA_DASHBOARD_URL=$NEXT_PUBLIC_GA_DASHBOARD_URL \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_BUILD_VERSION=$NEXT_PUBLIC_BUILD_VERSION
RUN --mount=type=cache,id=nx-cache,target=/app/.nx/cache \
    pnpm nx build admin --configuration=production

# ============================================
# Production stages — copy only the built output, not source
# ============================================
FROM node:24-alpine AS api
WORKDIR /app
ENV NODE_ENV=production
# ffprobe (bundled with the ffmpeg package) reads a video's real duration
# server-side before it's accepted — needed to enforce the product-video
# length cap, since a client-declared duration can't be trusted.
RUN --mount=type=cache,target=/var/cache/apk,sharing=locked \
    apk add ffmpeg
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

FROM node:24-alpine AS client
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# HOSTNAME=0.0.0.0 — the standalone server.js binds to a restrictive
# default otherwise (confirmed empirically: without it, the server starts
# but refuses connections even from inside the same container).
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# `output: 'standalone'` (apps/client/next.config.js) traces only the
# node_modules this app actually uses instead of shipping the full
# workspace-combined tree — this is what actually eliminates the client/
# admin size difference the api image already got from `pnpm prune --prod`.
# Paths below verified empirically against a real Linux build (Windows
# can't produce this output at all — file tracing needs symlinks) rather
# than assumed from a generic Next.js tutorial, because Nx's custom
# `distDir` (dist/apps/client/.next, not the default apps/client/.next)
# makes the standalone layout nest one level deeper than usual:
#   .next/standalone/apps/client/server.js         — entry point
#   .next/standalone/node_modules/                  — pruned, shared
#   .next/standalone/dist/apps/client/.next/        — server-side chunks
#     (server.js's own embedded distDir config point here, NOT to
#     .next/standalone/apps/client/.next — that path doesn't exist)
# .next/static and public/ are deliberately NOT included in standalone
# output by Next.js design; copied in separately below at the exact
# relative locations server.js resolves them from.
COPY --from=builder-client --chown=nextjs:nodejs /app/dist/apps/client/.next/standalone ./
COPY --from=builder-client --chown=nextjs:nodejs /app/dist/apps/client/.next/static ./dist/apps/client/.next/static
COPY --from=builder-client --chown=nextjs:nodejs /app/dist/apps/client/public ./apps/client/public
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1
CMD ["node", "apps/client/server.js"]

FROM node:24-alpine AS admin
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001
ENV HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
# Same standalone layout as the client stage above — see its comments for
# why the paths nest under dist/apps/admin/.next rather than the more
# common flat standalone/.next.
COPY --from=builder-admin --chown=nextjs:nodejs /app/dist/apps/admin/.next/standalone ./
COPY --from=builder-admin --chown=nextjs:nodejs /app/dist/apps/admin/.next/static ./dist/apps/admin/.next/static
COPY --from=builder-admin --chown=nextjs:nodejs /app/dist/apps/admin/public ./apps/admin/public
USER nextjs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1
CMD ["node", "apps/admin/server.js"]

# ============================================
# Migrate — targets `source`, never a per-app builder stage, so running
# migrations never forces an unrelated app to build.
# ============================================
FROM source AS migrate
CMD ["node_modules/.bin/prisma", "migrate", "deploy", "--schema=prisma/schema.prisma"]
