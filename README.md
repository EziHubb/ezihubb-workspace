# EziHubb — Handcrafted Goods Platform

A full-stack e-commerce platform for personalized handmade goods. Customers browse products, customize them in a live canvas editor (Fabric.js), and check out via Stripe or PayPal. Artisans and admins manage inventory, orders, and promotions through a separate admin panel.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Browser                                                            │
│  ┌─────────────────────┐  ┌──────────────────────────────────────┐  │
│  │  Storefront         │  │  Admin Panel                        │  │
│  │  Next.js 16 (App)   │  │  Next.js 16 (App)                   │  │
│  │  port 3000          │  │  port 3001                          │  │
│  └────────┬────────────┘  └─────────────┬────────────────────────┘  │
└───────────┼─────────────────────────────┼───────────────────────────┘
            │  REST + cookies             │  REST + JWT
            ▼                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│  NestJS API  (port 3002) — 33 feature modules, incl.:                │
│  Auth · Users · Products · Cart · Orders · Payments · Shipping      │
│  Reviews · Promotions · Notifications · Customization · Search      │
│  Affiliates · Referrals · Campaigns · Order Tracking · Moderation   │
│  PDF · Multi-currency · Shop Stats · Admin · Stores (marketplace)   │
│  Fulfillment (Printify/Merchize) · Partner API                     │
├───────────────────────┬─────────────────────────────────────────────┤
│  PostgreSQL (Prisma)  │  Redis (cache + queues)                    │
├───────────────────────┴─────────────────────────────────────────────┤
│  Cloudflare R2 (S3-compatible object storage + CDN)                │
│  SendGrid (transactional email)                                     │
│  Stripe (payments)  ·  PayPal (stub, ready)                        │
│  Sentry (error monitoring)  ·  Axiom (log aggregation)             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | 22.x |
| pnpm | 11.0.9 |
| Docker & Docker Compose | Latest |

---

## Quick Start

```bash
# 1. Clone and enter the repo
git clone https://github.com/EziHubb/ezihubb-workspace.git
cd ezihubb-workspace

# 2. First-time setup (installs deps, starts infra, migrates DB, seeds data)
make setup

# 3. Start all apps in dev mode
make dev
```

The setup command copies `.env.example` → `.env` — fill in blank values before running in production.

---

## App URLs

| App | URL | Description |
|-----|-----|-------------|
| Storefront | http://localhost:3000 | Customer-facing shop |
| Admin Panel | http://localhost:3001 | Staff / admin dashboard |
| API | http://localhost:3002 | NestJS REST API |
| API Docs | http://localhost:3002/api | Swagger UI |
| MailHog | http://localhost:8025 | Local email testing (run separately — not part of docker-compose.yml, which is production-only) |
| MinIO Console | http://localhost:9001 | Local S3 storage UI (run separately, same reason) |

---

## Key Commands

### Development

```bash
make dev              # Start all apps (client + admin + api)
make dev-api          # Start API only
make dev-client       # Start storefront only
make dev-admin        # Start admin only
```

### Testing

```bash
make test             # All unit tests
make test-api         # API unit tests only
make test-client      # Client unit tests only
make test-api-e2e     # API E2E tests (needs DB + Redis running)
make test-e2e         # Playwright browser tests
make test-e2e-ui      # Playwright in UI mode
```

### Database

```bash
make db-migrate       # Create and run a new migration (dev)
make db-seed          # Seed default categories, shipping zones, admin user
make db-reset         # Drop all and re-migrate + seed
make db-studio        # Open Prisma Studio in browser
```

### Build & Code Quality

```bash
make build            # Build all apps for production
make lint             # ESLint all projects
make type-check       # TypeScript strict type-check
```

### Nx-specific

```bash
pnpm nx graph                          # Visualize project graph
pnpm nx affected -t test               # Test only changed projects
pnpm nx run-many -t build --parallel=3 # Build all in parallel
```

---

## Project Structure

```
ezihubb-workspace/
├── apps/
│   ├── api/              # NestJS REST API
│   │   └── src/
│   │       ├── modules/  # Feature modules (auth, products, cart, orders…)
│   │       ├── common/   # Filters, guards, decorators, pipes
│   │       ├── prisma/   # PrismaService + PrismaModule
│   │       ├── queue/    # BullMQ job definitions
│   │       ├── health/   # GET /health endpoint
│   │       └── config/   # App/db/jwt/redis/storage configs
│   ├── client/           # Next.js storefront (App Router, i18n en/vi)
│   │   └── src/
│   │       ├── app/      # [locale] routes
│   │       ├── components/ # UI, layout, customizer, cart
│   │       ├── lib/      # Zustand store, types, helpers
│   │       └── messages/ # next-intl translations (en.json, vi.json)
│   └── admin/            # Next.js admin panel
├── libs/
│   ├── ui/               # @ezihubb/ui — shared React components
│   └── shared/
│       ├── types/        # @ezihubb/types — shared TypeScript interfaces
│       ├── constants/    # @ezihubb/constants — enums, magic numbers
│       ├── api-client/   # @ezihubb/api-client — fetch client + React Query hooks
│       └── utils/        # shared utility functions
├── prisma/               # Prisma schema + migrations + seed
├── e2e/                  # Playwright end-to-end tests
├── docker/               # Dockerfiles (api, client, admin, migrate)
├── scripts/              # smoke-test.sh and other utilities
├── .github/workflows/    # CI GitHub Actions
├── docker-compose.yml    # Self-hosted production stack
├── Makefile              # Developer shortcuts
└── .env.example          # All environment variable defaults
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in all blank values. App-specific examples:

| App | Example file |
|-----|-------------|
| API | [apps/api/.env.example](apps/api/.env.example) |
| Storefront | [apps/client/.env.local.example](apps/client/.env.local.example) |
| Admin | [apps/admin/.env.local.example](apps/admin/.env.local.example) |
| Test suite | [.env.test](.env.test) |

Key secrets required for production:

```bash
JWT_ACCESS_SECRET      # 64-char random: openssl rand -hex 32
JWT_REFRESH_SECRET     # 64-char random: openssl rand -hex 32
STRIPE_SECRET_KEY      # sk_live_...
STRIPE_WEBHOOK_SECRET  # whsec_... (from Stripe dashboard)
SENDGRID_API_KEY       # SG....
AWS_ACCESS_KEY_ID      # Cloudflare R2 access key
AWS_SECRET_ACCESS_KEY  # Cloudflare R2 secret key
SENTRY_DSN             # https://...@sentry.io/...
```

---

## Deployment

### AWS EC2 (Docker, built on the instance)

Runs on a dedicated AWS EC2 instance. Images are **built directly on the instance** via the Dockerfiles in [docker/](docker/) — [docker-compose.yml](docker-compose.yml)'s `build:` blocks. (A CI-build path exists too — [.github/workflows/docker-publish.yml](.github/workflows/docker-publish.yml) builds api/client/admin/migrate to GitHub Container Registry — but it's on hold; switching back just means changing the `build:` blocks to `image: ${DOCKER_IMAGE_BASE}-...` pulls.) [scripts/deploy.sh](scripts/deploy.sh) provisions a swap file and only rebuilds images whose own files changed, one at a time, to stay within a small instance's RAM.

Postgres runs on AWS RDS Free Tier (not a container) — set `DATABASE_URL` in `.env` to the RDS endpoint. Redis and MongoDB stay self-hosted in Docker (switch `MONGODB_URI` to a MongoDB Atlas free-tier cluster instead if the instance's RAM gets tight — no code change needed). `client`/`admin`/`api` are published to `127.0.0.1` only (`CLIENT_PORT`/`ADMIN_PORT`/`API_PORT` in `.env`, defaults 3010/3011/3012); the host's own nginx reverse-proxies `ezihubb.com` / `admin.ezihubb.com` / `api.ezihubb.com` (via Cloudflare, Full-strict SSL with an Origin Certificate) to those ports.

1. Copy `.env.example` to `.env` on the instance and fill in real values, including `DATABASE_URL` (RDS endpoint) and `MONGO_ROOT_USER`/`MONGO_ROOT_PASSWORD`/`MONGODB_URI`.
2. One-time host nginx setup — see [scripts/nginx-ezihubb.conf](scripts/nginx-ezihubb.conf) for the Cloudflare DNS records and Origin Certificate to create, then installing the site.
3. Run migrations once: `docker compose run --rm migrate`
4. Start the stack: `docker compose up -d --build`, or use [scripts/deploy.sh](scripts/deploy.sh) to do all of the above remotely from your machine (config in `scripts/.deploy-config`, gitignored).

Cloudflare R2 and SendGrid remain external managed services — only `AWS_S3_*` / `SENDGRID_*` need to be set in `.env`.

`make setup` does not start any local database — point `DATABASE_URL`/`MONGODB_URI`/`REDIS_URL` in `.env` at whatever Postgres/MongoDB/Redis you use for local development (local install or a remote dev instance).

### Storefront & Admin → Vercel (alternative)

1. Import `apps/client` and `apps/admin` as separate Vercel projects.
2. Build command: `pnpm nx build client --configuration=production`
3. Set all `NEXT_PUBLIC_*` env vars in the Vercel dashboard.
4. Vercel configs are at [apps/client/vercel.json](apps/client/vercel.json) and [apps/admin/vercel.json](apps/admin/vercel.json).

### CI/CD Pipeline (GitHub Actions)

| Trigger | Workflow | Steps |
|---------|----------|-------|
| PR to main/develop | `ci.yml` | lint → type-check → unit tests → build → audit |

Deployment to the self-hosted server is not yet automated — trigger it manually (or add a new workflow once the server's access method, e.g. SSH, is decided).

---

## Smoke Test

```bash
# Test local setup
./scripts/smoke-test.sh

# Test a deployed environment
./scripts/smoke-test.sh https://api.ezihubb.com https://ezihubb.com
```

---

## Contributing

Currently a single `main` branch — no `develop`/staging branch or automated deploy pipeline exists yet (see [Deployment](#deployment) above, which is manual).

1. Branch from `main`: `git checkout -b feature/my-feature`
2. Follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(cart): add coupon validation`
3. Run `make lint && make test` before opening a PR
4. PR targets `main` → reviewed → merged → deploy manually with `scripts/deploy.sh`
