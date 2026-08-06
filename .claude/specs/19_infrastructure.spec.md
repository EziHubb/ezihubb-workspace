# Module 19 — Infrastructure & Deployment

## 1. Nx Monorepo Structure

```
ezihubb-workspace/
  apps/
    api/           # NestJS REST API (port 3002)
    client/        # Next.js 16 storefront (port 3000)
    admin/         # Next.js 16 admin panel (port 3001)
  libs/
    shared/
      types/       # @ezihubb/types — shared TypeScript types
      api-client/  # @ezihubb/api-client — fetch client + React Query hooks
      constants/   # @ezihubb/constants — shared constants
    ui/            # @ezihubb/ui — shared React component library
  prisma/
    schema.prisma      # 100+ models (grew far past the original 21 as
                        # marketplace features were added)
    seed.ts             # thin orchestrator → delegates to seeds/pg/ + seeds/mongo/
    seeds/
      pg/               # 21 numbered PostgreSQL seed files + index.ts
      mongo/            # MongoDB seed files (product_details, category_menus) + index.ts
      shared/           # prisma-client.ts, mongo-schemas.ts
  prisma.config.ts   # repo root, NOT inside prisma/
  .claude/specs/   # This directory
```

## 2. Package Manager & Versions

| Tool | Version |
|---|---|
| pnpm | 11.5.2 |
| Node.js | 22.x |
| Nx | 22.7.2 |
| TypeScript | ~5.7.2 |
| Next.js | ~16.1.6 |
| NestJS | ^11.0.0 |
| Prisma | ^7.8.0 |
| Mongoose | ^9.6.3 |
| React | ^19.0.0 |
| Tailwind CSS | 3.x |
| Zustand | ^5.0.5 |
| TanStack Query | ^5.80.0 |
| BullMQ | ^5.77.3 |
| Stripe SDK | ^22.1.1 |
| Fabric.js | ^6.6.1 (customizer canvas) |
| Zod | ^4.4.3 |

## 3. Self-hosted Deployment (Docker)

### Services
| Service | Config |
|---|---|
| API | NestJS, port 3002, `docker/Dockerfile` (target `api`) |
| Client | Next.js, port 3000, `docker/Dockerfile` (target `client`) |
| Admin | Next.js, port 3001, `docker/Dockerfile` (target `admin`) |
| PostgreSQL | Self-hosted (own server or managed instance) |
| Redis | Self-hosted (own server or managed instance) |
| nginx | Host-level (shared with other projects on the same server), not a container — see `scripts/nginx-ezihubb.conf` |

`docker-compose.yml` (single file, production-only — no separate dev compose, no bundled nginx container) publishes each app to `127.0.0.1` only (never the public interface), via `CLIENT_PORT`/`ADMIN_PORT`/`API_PORT` (default `3010`/`3011`/`3012`). The host-level nginx reverse-proxies public subdomains — `ezihubb.com` (storefront), `admin.ezihubb.com`, `api.ezihubb.com` — to those local ports. No path-based routing.

### Environment Variables
- `DATABASE_URL` — PostgreSQL connection string
- `MONGODB_URI` — MongoDB Atlas `mongodb+srv://` URI
- `REDIS_URL` — Redis connection string
- `NEXT_PUBLIC_API_URL` — API public URL (NO /api/v1 suffix)
- `CORS_ORIGINS` — comma-separated allowed origins
- All secret keys (JWT, Stripe, SendGrid, etc.)

### CORS Fix for Production
```
CORS_ORIGINS="https://ezihubb.com,https://admin.ezihubb.com"
```
Không dùng `origin: '*'` với `credentials: true`.

### apiClient URL Fix
`NEXT_PUBLIC_API_URL` KHÔNG được có suffix `/api/v1`.
`apiClient` tự strip và re-add:
```typescript
let baseUrl = (process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3002')
  .replace(/\/api\/v1\/?$/, '');
```

## 4. MongoDB Atlas

### Connection
- SRV URI: `mongodb+srv://user:pass@cluster0.xxx.mongodb.net/`
- UDP port 53 có thể bị block trong cloud/container environments
- Solution: DNS-over-HTTPS (DoH) via `dns.google/resolve`

### DoH Resolution (in main.ts and mongodb.module.ts)
```typescript
async function resolveMongoSrvUri(uri: string): Promise<string> {
  // Resolves _mongodb._tcp.<host> SRV record via HTTPS
  // Rewrites to direct mongodb:// connection string
  // Used in: main.ts (API), modules/database/mongodb.module.ts
  // (prisma/seeds/mongo uses a simpler fix: dns.setServers(['8.8.8.8','1.1.1.1']))
}
```

### Collections
- `product_details` — product MongoDB detail (schema: ProductDetail)
- `category_menus` — mega-menu structure (schema: CategoryMenu)
- `customization_drafts` — (referenced via Prisma, not Mongoose directly)

## 5. Nx Commands

```bash
# Run tasks
pnpm nx serve api           # Start API dev server (port 3002)
pnpm nx serve client        # Start client dev server (port 3000)
pnpm nx serve admin         # Start admin dev server (port 3001)
pnpm nx build api           # Build API
pnpm nx build client        # Build client
pnpm nx build admin         # Build admin
pnpm nx lint api            # Lint
pnpm nx test api            # Test
pnpm nx affected --target=build  # Build only affected projects

# Generate (always use nx-generate skill first)
pnpm nx g @nx/nest:module    # Add NestJS module
pnpm nx g @nx/next:page      # Add Next.js page
```

## 6. Dev Environment

### Required Services (local dev)
| Service | How | Port |
|---|---|---|
| PostgreSQL | Local Docker (or any remote Postgres) | 5432 |
| MongoDB | Atlas (cloud) | — |
| Redis | Optional (DISABLE_QUEUE=true to skip) | 6379 |
| MinIO (S3) | Docker (`minio/minio`) | 9000 (S3) / 9001 (UI) |
| MailHog | Docker (`mailhog/mailhog`) | 1025 (SMTP) / 8025 (UI) |
| LibreTranslate | Docker (optional, fallback) | 5000 |

### DISABLE_QUEUE=true
Khi Redis không available locally:
- Set `DISABLE_QUEUE=true` trong `.env`
- `DevBullModule` provides no-op queue tokens
- `RedisService.available` flag ngăn connection errors crash API
- `uncaughtException` handler catches Redis `ECONNREFUSED`

## 7. CI/CD

- Git: GitHub repository
- Deploy: manual/self-hosted server (Docker), no auto-deploy workflow configured yet
- Build command: `pnpm nx build <app>`
- Start command: `node dist/apps/<app>/main.js` (API) hoặc `pnpm next start` (Next)

## 8. Environment Files

| File | Purpose |
|---|---|
| `.env` | Local development (gitignored, contains real creds) |
| `.env.example` | Template (committed, no real creds) |
| Server env vars | Production secrets, set directly on the host (never in git) |

### Key ENV Variables

```
# App
NODE_ENV=development
PORT=3002
NEXT_PUBLIC_API_URL=http://localhost:3002   # NO /api/v1 suffix
NEXT_PUBLIC_ADMIN_URL=http://localhost:3001

# Databases
DATABASE_URL=postgresql://...
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://localhost:6379

# Auth
JWT_ACCESS_SECRET=...   # min 64 chars
JWT_REFRESH_SECRET=...  # min 64 chars
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Storage (Cloudflare R2 in prod, MinIO locally)
AWS_S3_ENDPOINT=http://localhost:9000
AWS_S3_BUCKET=ezihubb-assets
CDN_URL=http://localhost:9000/ezihubb-assets
NEXT_PUBLIC_CDN_URL=http://localhost:9000/ezihubb-assets

# Payment
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Email
SENDGRID_API_KEY=...
EMAIL_FROM=noreply@ezihubb.com
SMTP_HOST=localhost        # dev: MailHog
SMTP_PORT=1025

# AI — Background Removal
BG_REMOVAL_PROVIDER=remove_bg
BG_REMOVAL_API_KEY=...

# AI — Art Style (Replicate)
REPLICATE_API_KEY=r8_...

# Analytics
NEXT_PUBLIC_GA_ID=G-...
NEXT_PUBLIC_GTM_ID=GTM-...
NEXT_PUBLIC_META_PIXEL_ID=...
GA_MEASUREMENT_ID=G-...
GA_API_SECRET=...

# Hotjar
NEXT_PUBLIC_HOTJAR_ID=...
NEXT_PUBLIC_HOTJAR_SV=6

# Monitoring
SENTRY_DSN=...
AXIOM_TOKEN=...
AXIOM_DATASET=ezihubb-dev

# Rate Limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=300

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# EasyPost (Carrier Labels)
EASYPOST_API_KEY=EZabc...

# Firebase (FCM Push Notifications)
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...

# Multi-Currency
EXCHANGE_RATE_API_KEY=...

# Web3 / NFT
ALCHEMY_API_KEY=...
NEXT_PUBLIC_CHAIN_ID=1
NFT_CONTRACT_ADDRESS=...

# Translation Services
GOOGLE_TRANSLATE_API_KEY=...
DEEPL_API_KEY=...
LIBRETRANSLATE_URL=http://localhost:5000  # self-hosted
```

## 9. Cloudflare R2 (Storage)

- Dev: MinIO (S3-compatible) tại `http://localhost:9000`
- Prod: Cloudflare R2
- Config: AWS SDK với custom endpoint (`AWS_S3_ENDPOINT`)
- Bucket: `ezihubb-assets`
- CDN URL: `CDN_URL` env var
- Subfolders:
  - `uploads/temp/` — presigned upload staging
  - `uploads/` — permanent product images, avatars
  - `previews/` — generated customization previews
  - `templates/` — product template base images

## 10. Next.js Build Notes

- Next.js 16 requires postinstall patches cho Nx compatibility
- `postinstall` script trong `package.json` applies patches
- `apps/client/next.config.js` — image domains, i18n, webpack overrides
- `apps/admin/next.config.js` — admin-specific config

## 11. BullMQ Queues

Source of truth: `apps/api/src/queue/queue.constants.ts` (`QUEUES` const).

| Queue Name | Purpose |
|---|---|
| `email` | Email sending |
| `image-processing` | BG removal, preview generation, art style |
| `order-processing` | Order post-processing (order-confirmed, auto-complete) |
| `scheduled` | Cron-triggered jobs (review reminders, daily order auto-complete, weekly cart cleanup) |
| `abandoned-cart` | Abandoned cart scan + recovery email |
| `affiliate-commission` | Commission calculation processor |
| `low-stock` | Daily low-stock scan |
| `translations` | AutoTranslate product content |
| `referral` | Referral auto-confirm + tier check |
| `moderation` | Text/image content moderation checks |
| `order-tracking` | Carrier status polling, tracking stage updates |

Note: PDF generation is synchronous (not queued) — see `PdfService` in module 20; there is no dedicated `pdf-generation` or `push-notification` queue — push dispatch happens inline via `PushService`.

## 12. NestJS Modules

Các modules đã implement trong `apps/api/src/modules/` (31 modules):

`admin`, `admin-users`, `affiliates`, `analytics`, `assets`, `auth`, `campaigns`, `cart`, `catalog`, `currency`, `customization`, `database` (mongodb), `messages`, `moderation`, `notifications` (bao gồm FcmService + PushService), `order-tracking`, `orders`, `payments`, `pdf`, `products` (bao gồm LowStockService), `promotions`, `referrals`, `reviews`, `search`, `shipping`, `shop-stats`, `stores`, `tax`, `translations`, `unsubscribe`, `users`

> Một loạt module đã bị xoá để đưa site về đúng nghĩa bán hàng thuần tuý: `loyalty`, `coins`, `vip`, `store-credits`, `flash-deals`, `gift-pools`, `gift-chains`, `gift-finder`, `blind-match` (social gifting/gamification), và riêng biệt `bounties`, `design-licensing`, `canva`, `memberships`, `creator-dna`, `trends`, `pricing`, `ai` (admin-ai), `drops`, `bundles` (creator-tooling/AI/merchandising add-ons).
