# Module 19 — Infrastructure & DevOps Spec

## 1. Tổng quan

| Concern | Tool |
|---------|------|
| Containerization | Docker + Docker Compose |
| Monorepo | Nx |
| CI/CD | GitHub Actions |
| Hosting — Frontend | Vercel |
| Hosting — Backend | Railway hoặc Render (hoặc AWS ECS) |
| Database | Supabase (managed PostgreSQL) hoặc Railway PostgreSQL |
| Cache / Queue | Upstash Redis (managed) |
| Storage | Cloudflare R2 (S3-compatible, rẻ hơn S3) |
| CDN | Cloudflare (tự động khi dùng R2) |
| Email | SendGrid |
| Monitoring | Sentry (error) + Axiom (logs) |
| Uptime | Better Uptime hoặc UptimeRobot |

---

## 2. Docker Compose (Local Development)

```yaml
# docker-compose.yml
version: '3.9'

services:
  # ── PostgreSQL ────────────────────────────────────────
  postgres:
    image: postgres:15-alpine
    container_name: mapleloomhandmade_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: mapleloomhandmade
      POSTGRES_PASSWORD: mapleloomhandmade_dev_pass
      POSTGRES_DB: mapleloomhandmade_dev
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U mapleloomhandmade']
      interval: 10s
      timeout: 5s
      retries: 5

  # ── Redis ─────────────────────────────────────────────
  redis:
    image: redis:7-alpine
    container_name: mapleloomhandmade_redis
    restart: unless-stopped
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 10s
      timeout: 5s
      retries: 5

  # ── MinIO (S3-compatible local storage) ───────────────
  minio:
    image: minio/minio:latest
    container_name: mapleloomhandmade_minio
    restart: unless-stopped
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    ports:
      - '9000:9000'   # S3 API
      - '9001:9001'   # Console UI
    volumes:
      - minio_data:/data
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:9000/minio/health/live']
      interval: 30s
      timeout: 20s
      retries: 3

  # ── MailHog (local email testing) ────────────────────
  mailhog:
    image: mailhog/mailhog:latest
    container_name: mapleloomhandmade_mailhog
    restart: unless-stopped
    ports:
      - '1025:1025'   # SMTP
      - '8025:8025'   # Web UI

  # ── NestJS API ────────────────────────────────────────
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: development
    container_name: mapleloomhandmade_api
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    environment:
      NODE_ENV: development
      DATABASE_URL: postgresql://mapleloomhandmade:mapleloomhandmade_dev_pass@postgres:5432/mapleloomhandmade_dev
      REDIS_URL: redis://redis:6379
      AWS_S3_ENDPOINT: http://minio:9000
      AWS_S3_BUCKET: mlh-assets
      AWS_ACCESS_KEY_ID: minioadmin
      AWS_SECRET_ACCESS_KEY: minioadmin123
      SMTP_HOST: mailhog
      SMTP_PORT: 1025
    ports:
      - '3001:3001'
    volumes:
      - ./apps/api/src:/app/apps/api/src  # hot reload
    command: yarn nx serve api

  # ── Next.js Frontend ──────────────────────────────────
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: development
    container_name: mapleloomhandmade_web
    restart: unless-stopped
    depends_on:
      - api
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:3001/api/v1
    ports:
      - '3000:3000'
    volumes:
      - ./apps/web/src:/app/apps/web/src  # hot reload
    command: yarn nx serve web

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

---

## 3. Dockerfile — NestJS API

```dockerfile
# apps/api/Dockerfile

# ── Base ──────────────────────────────────────────────
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# ── Development ───────────────────────────────────────
FROM base AS development
COPY . .
EXPOSE 3001
CMD ["yarn", "nx", "serve", "api"]

# ── Builder ───────────────────────────────────────────
FROM base AS builder
COPY . .
RUN yarn nx build api --prod
RUN yarn prisma generate

# ── Production ────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/dist/apps/api ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/apps/api/prisma ./prisma

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nestjs
USER nestjs

EXPOSE 3001
CMD ["node", "dist/main.js"]
```

---

## 4. Dockerfile — Next.js Frontend

```dockerfile
# apps/web/Dockerfile

FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

FROM base AS development
COPY . .
EXPOSE 3000
CMD ["yarn", "nx", "serve", "web"]

FROM base AS builder
COPY . .
RUN yarn nx build web --prod

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
USER nextjs

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

---

## 5. CI/CD — GitHub Actions

### Workflow: PR Check (`pr-check.yml`)
```yaml
name: PR Check

on:
  pull_request:
    branches: [main, develop]

jobs:
  lint-and-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'
      - run: yarn install --frozen-lockfile
      - run: yarn nx affected --target=lint --base=origin/main
      - run: yarn nx affected --target=type-check --base=origin/main

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: mapleloomhandmade_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'
      - run: yarn install --frozen-lockfile
      - run: yarn prisma migrate deploy
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/mapleloomhandmade_test
      - run: yarn nx affected --target=test --base=origin/main
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/mapleloomhandmade_test
          JWT_ACCESS_SECRET: test-secret
          JWT_REFRESH_SECRET: test-refresh-secret

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'
      - run: yarn install --frozen-lockfile
      - run: yarn nx affected --target=build --base=origin/main
```

### Workflow: Deploy Production (`deploy-production.yml`)
```yaml
name: Deploy Production

on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Railway
        uses: bervProject/railway-deploy@main
        with:
          railway_token: ${{ secrets.RAILWAY_TOKEN }}
          service: mapleloomhandmade-api

  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  run-migrations:
    runs-on: ubuntu-latest
    needs: [deploy-api]
    steps:
      - uses: actions/checkout@v4
      - run: yarn install --frozen-lockfile
      - run: yarn prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }}
```

---

## 6. Branch Strategy

```
main          ← production (protected, require PR + review)
  │
develop       ← staging (auto-deploy to staging env)
  │
feature/*     ← feature branches (PR → develop)
hotfix/*      ← urgent fixes (PR → main + backmerge → develop)
```

**Commit convention (Conventional Commits):**
```
feat(auth): add Google OAuth login
fix(cart): fix quantity not updating on mobile
chore(deps): upgrade Prisma to 5.x
perf(search): add Redis cache for autocomplete
```

---

## 7. Environment Variables — Đầy đủ

```bash
# ── App ────────────────────────────────────────────────
NODE_ENV=production
APP_URL=https://mapleloomhandmade.com
API_URL=https://api.mapleloomhandmade.com
FRONTEND_URL=https://mapleloomhandmade.com

# ── Database ───────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host:5432/mapleloomhandmade?schema=public&connection_limit=20

# ── Redis ──────────────────────────────────────────────
REDIS_URL=rediss://default:token@host:6380

# ── Auth ───────────────────────────────────────────────
JWT_ACCESS_SECRET=<64-char-random>
JWT_REFRESH_SECRET=<64-char-random>
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d
JWT_REMEMBER_ME_EXPIRES_IN=90d

# ── OAuth ──────────────────────────────────────────────
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_CALLBACK_URL=https://api.mapleloomhandmade.com/api/v1/auth/google/callback

# ── Storage (Cloudflare R2) ────────────────────────────
AWS_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
AWS_S3_BUCKET=mlh-assets
AWS_S3_REGION=auto
AWS_ACCESS_KEY_ID=<r2-access-key>
AWS_SECRET_ACCESS_KEY=<r2-secret-key>
CDN_URL=https://cdn.mapleloomhandmade.com   # Cloudflare custom domain trỏ vào R2

# ── Storage subfolders
UPLOAD_TEMP_PREFIX=uploads/temp/
UPLOAD_PERMANENT_PREFIX=uploads/
PREVIEW_PREFIX=previews/
TEMPLATE_PREFIX=templates/

# ── Payment ────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
PAYPAL_CLIENT_ID=xxx
PAYPAL_CLIENT_SECRET=xxx
PAYPAL_MODE=live   # sandbox | live

# ── Email ──────────────────────────────────────────────
SENDGRID_API_KEY=SG.xxx
EMAIL_FROM=noreply@mapleloomhandmade.com
EMAIL_FROM_NAME=MapleLoomHandmade

# ── AI / Background Removal ────────────────────────────
BG_REMOVAL_PROVIDER=remove_bg   # remove_bg | photoroom | clipdrop
BG_REMOVAL_API_KEY=xxx
BG_REMOVAL_API_URL=https://api.remove.bg/v1.0/removebg

# ── Monitoring ─────────────────────────────────────────
SENTRY_DSN=https://xxx@sentry.io/xxx
AXIOM_TOKEN=xxx
AXIOM_DATASET=mapleloomhandmade-prod

# ── Rate Limiting ──────────────────────────────────────
THROTTLE_TTL=60000    # ms
THROTTLE_LIMIT=300

# ── Next.js Public vars ────────────────────────────────
NEXT_PUBLIC_API_URL=https://api.mapleloomhandmade.com/api/v1
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
NEXT_PUBLIC_PAYPAL_CLIENT_ID=xxx
NEXT_PUBLIC_CDN_URL=https://cdn.mapleloomhandmade.com
NEXT_PUBLIC_GA_ID=G-xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/xxx
```

---

## 8. Database Migration Strategy

```bash
# Development — tạo migration mới
yarn prisma migrate dev --name add_search_vector_to_products

# Staging / Production — apply migrations
yarn prisma migrate deploy

# Rollback: Prisma không có built-in rollback
# → Viết migration mới để revert thay đổi
# → Hoặc restore từ DB backup

# Seed data (categories, shipping zones mặc định)
yarn prisma db seed
```

**Seed file (`prisma/seed.ts`) phải tạo:**
- Default shipping zones (US, EU, UK, AU)
- Default shipping methods per zone
- Admin user (từ env vars)
- Sample categories (Drinkware, Apparel, Home Decor, Accessories)

---

## 9. Monitoring & Alerting

### Error Tracking (Sentry)
- NestJS: `@sentry/node` với exception filter
- Next.js: `@sentry/nextjs` tự động wrap pages
- Alerts: Email khi error rate > 1% trong 5 phút

### Log Aggregation (Axiom)
- Winston transport → Axiom
- Log tất cả API requests (method, path, status, duration, requestId)
- Log tất cả queue jobs (start, complete, fail)
- Log tất cả payment events

### Uptime Monitoring
- Ping `GET /api/v1/health` mỗi 1 phút
- Health check endpoint trả về:
```json
{
  "status": "ok",
  "timestamp": "2024-06-01T10:00:00.000Z",
  "services": {
    "database": "ok",
    "redis": "ok",
    "storage": "ok"
  },
  "version": "1.2.3"
}
```

---

## 10. Backup Strategy

| Resource | Frequency | Retention | Tool |
|----------|-----------|-----------|------|
| PostgreSQL | Mỗi 6 giờ | 30 ngày | Supabase auto-backup hoặc pg_dump |
| R2 Storage | Versioning enabled | Vĩnh viễn | Cloudflare R2 versioning |
| Redis | Không cần backup | — | Data is ephemeral (cache/queue) |

**Point-in-time recovery:** Supabase hỗ trợ PITR cho plan Pro+.

---

## 11. Security Checklist

- [ ] HTTPS only (HSTS header)
- [ ] Helmet.js (NestJS) — security headers
- [ ] Rate limiting trên tất cả public endpoints
- [ ] JWT secret rotation procedure documented
- [ ] Stripe webhook signature verification
- [ ] SQL injection: sử dụng Prisma parameterized queries
- [ ] XSS: Next.js tự escape, Zod validate input
- [ ] CORS chỉ allow frontend domain
- [ ] Sensitive data masked trong logs
- [ ] Admin routes protected by role guard
- [ ] File upload: validate MIME type server-side (không tin client)
- [ ] Dependency audit: `yarn audit` trong CI
- [ ] Secrets không commit vào repo (`.env` trong `.gitignore`)
