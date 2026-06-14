# Module 19 — Infrastructure & Deployment

## 1. Nx Monorepo Structure

```
maple-loom-handmade-workspace/
  apps/
    api/           # NestJS REST API (port 3002)
    client/        # Next.js 16 storefront (port 3000)
    admin/         # Next.js 16 admin panel (port 3001)
  libs/
    shared/
      types/       # @mlh/types — shared TypeScript types
      api-client/  # @mlh/api-client — fetch client + React Query hooks
      constants/   # @mlh/constants — shared constants
    ui/            # @mlh/ui — shared React component library
  prisma/
    schema.prisma
    seed.ts
    seed-mongo.ts
    prisma.config.ts
  .claude/specs/   # This directory
```

## 2. Package Manager & Versions

| Tool | Version |
|---|---|
| pnpm | 11.0.9 |
| Node.js | 20+ |
| Nx | 22.7.2 |
| TypeScript | ~5.7.2 |
| Next.js | ~16.1.6 |
| NestJS | ^11.0.0 |
| Prisma | ^7.8.0 |
| Mongoose | ^9.6.3 |
| React | 18 |
| Tailwind CSS | 3.x |
| Zustand | ^5.0.5 |
| TanStack Query | ^5.80.0 |
| BullMQ | ^5.77.3 |
| Stripe SDK | ^22.1.1 |
| Fabric.js | 5.x (customizer canvas) |
| Zod | ^4.4.3 |

## 3. Railway Deployment

### Services
| Service | Config |
|---|---|
| API | NestJS, port 3002, Dockerfile or Nixpacks |
| Client | Next.js, port 3000, Nixpacks |
| Admin | Next.js, port 3001, Nixpacks |
| PostgreSQL | Railway managed |
| Redis | Railway managed |

### Environment Variables (Railway)
- `DATABASE_URL` — Railway PostgreSQL connection string
- `MONGODB_URI` — MongoDB Atlas `mongodb+srv://` URI
- `REDIS_URL` — Railway Redis URL
- `NEXT_PUBLIC_API_URL` — API public URL (NO /api/v1 suffix)
- `CORS_ORIGINS` — comma-separated allowed origins
- All secret keys (JWT, Stripe, SendGrid, etc.)

### CORS Fix for Production
```
CORS_ORIGINS="https://dailydaisy.com,https://admin.dailydaisy.com"
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
- UDP port 53 có thể bị block trong Railway/cloud environments
- Solution: DNS-over-HTTPS (DoH) via `dns.google/resolve`

### DoH Resolution (in main.ts)
```typescript
async function resolveMongoSrvUri(uri: string): Promise<string> {
  // Resolves _mongodb._tcp.<host> SRV record via HTTPS
  // Rewrites to direct mongodb:// connection string
  // Used in: main.ts (API), seed.ts, seed-mongo.ts
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
| PostgreSQL | Railway or local Docker | 5432 |
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
- Railway auto-deploy on push to `main` branch
- Build command: `pnpm nx build <app>`
- Start command: `node dist/apps/<app>/main.js` (API) hoặc `pnpm next start` (Next)

## 8. Environment Files

| File | Purpose |
|---|---|
| `.env` | Local development (gitignored, contains real creds) |
| `.env.example` | Template (committed, no real creds) |
| Railway UI | Production secrets (never in git) |

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
AWS_S3_BUCKET=mlh-assets
CDN_URL=http://localhost:9000/mlh-assets
NEXT_PUBLIC_CDN_URL=http://localhost:9000/mlh-assets

# Payment
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Email
SENDGRID_API_KEY=...
EMAIL_FROM=noreply@dailydaisy.com
SMTP_HOST=localhost        # dev: MailHog
SMTP_PORT=1025

# AI — Background Removal
BG_REMOVAL_PROVIDER=remove_bg
BG_REMOVAL_API_KEY=...

# AI — Art Style (Replicate)
REPLICATE_API_KEY=r8_...

# AI / OpenAI (NFT Pricing, Creator DNA)
OPENAI_API_KEY=sk-...

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
AXIOM_DATASET=dailydaisy-dev

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

# Canva Integration
CANVA_CLIENT_ID=...
CANVA_CLIENT_SECRET=...
CANVA_REDIRECT_URI=...

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
- Bucket: `mlh-assets`
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

| Queue Name | Purpose |
|---|---|
| `email-queue` | Email sending |
| `image-processing-queue` | BG removal, art style |
| `order-processing-queue` | Order post-processing |
| `loyalty-unlock` | Unlock pending points sau 14 ngày |
| `stock-alert-queue` | Daily low-stock scan (7am UTC cron) |
| `pdf-generation-queue` | Async PDF generation (invoices) |
| `push-notification-queue` | FCM push dispatch |
| `translation-queue` | AutoTranslate product content |

## 12. NestJS Modules

Các modules đã implement trong `apps/api/src/modules/`:

`admin`, `admin-users`, `affiliates`, `ai` (admin-ai), `analytics`, `assets`, `auth`, `blind-match`, `bounties`, `bundles`, `campaigns`, `canva`, `cart`, `catalog`, `coins`, `creator-dna`, `currency`, `customization`, `database` (mongodb), `design-licensing`, `drops`, `flash-deals`, `gift-chains`, `gift-finder`, `gift-pools`, `loyalty`, `memberships`, `messages`, `moderation`, `notifications` (bao gồm FcmService + PushService), `order-tracking`, `orders`, `payments`, `pdf`, `pricing`, `products` (bao gồm LowStockService), `promotions`, `referrals`, `reviews`, `search`, `shipping`, `shop-stats`, `store-credits`, `stores`, `tax`, `translations`, `trends`, `users`, `vip`
