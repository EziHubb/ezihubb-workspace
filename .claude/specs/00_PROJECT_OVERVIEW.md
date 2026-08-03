# EziHubb — Project Overview

## 1. Mô tả dự án

**EziHubb** là nền tảng thương mại điện tử chuyên về quà tặng cá nhân hoá (personalized gifts). Người dùng có thể chọn sản phẩm (cốc, canvas, hoodie, ornament...) và cá nhân hoá trực tiếp bằng công cụ customizer tích hợp Fabric.js trước khi mua hàng.

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Monorepo** | Nx | 22.7.2 |
| **Package Manager** | pnpm | 11.5.2 |
| **Language** | TypeScript | ~5.7.2 |
| **Frontend** | Next.js (Turbopack) | ~16.1.6 |
| **React** | React | ^19.0.0 |
| **Backend** | NestJS | ^11.0.0 |
| **ORM** | Prisma | ^7.8.0 (driver adapter) |
| **SQL Adapter** | @prisma/adapter-pg | ^7.8.0 |
| **MongoDB** | Mongoose / @nestjs/mongoose | ^9.6.3 / ^11.0.4 |
| **Queue** | BullMQ / @nestjs/bullmq | ^5.77.3 / ^11.0.4 |
| **Redis** | ioredis | ^5.10.1 |
| **State** | Zustand | ^5.0.5 |
| **Server State** | TanStack React Query | ^5.80.0 |
| **Canvas** | Fabric.js | ^6.6.1 |
| **Payment** | Stripe + PayPal | stripe ^22.1.1 |
| **Auth** | JWT + Google OAuth2 | passport-jwt ^4.0.1 |
| **Storage** | Cloudflare R2 (S3-compat) | aws-sdk ^3.x |
| **Email** | Nodemailer / SendGrid | ^8.0.8 |
| **i18n** | next-intl | ^4.12.0 |
| **Forms** | react-hook-form + zod | ^7.76.1 / ^4.4.3 |

## 3. Kiến trúc Monorepo

```
ezihubb-workspace/
├── apps/
│   ├── api/          → NestJS backend (port 3002)
│   ├── client/       → Next.js storefront (port 3000)
│   └── admin/        → Next.js admin panel (port 3001)
├── libs/
│   ├── shared/types/     → Shared TypeScript DTOs
│   ├── shared/api-client/ → React Query hooks + HTTP client
│   ├── shared/constants/ → API routes, enums, constants
│   └── ui/               → Shared React component library
├── prisma/
│   ├── schema.prisma     → PostgreSQL schema (100+ models — grew far beyond the original
│   │                        21 as marketplace features were added: stores, affiliates,
│   │                        loyalty, referrals, moderation, gift chains/pools, flash
│   │                        deals, blind-match, campaigns, coins, etc.)
│   ├── seed.ts           → Thin orchestrator — delegates to seeds/pg/ and seeds/mongo/
│   └── seeds/
│       ├── pg/           → 21 numbered PostgreSQL seed files + index.ts
│       ├── mongo/        → MongoDB seed files (product_details, category_menus) + index.ts
│       └── shared/       → prisma-client.ts, mongo-schemas.ts (shared helpers)
├── prisma.config.ts      → Prisma 7 adapter config (repo root, not inside prisma/)
└── .claude/specs/        → Module specifications (this directory)
```

## 4. Cơ sở dữ liệu

### PostgreSQL — Transactional
- Users, Auth tokens, Products, Variants, Orders, Cart, Payments, Reviews, Promotions, Shipping
- Prisma 7 + `@prisma/adapter-pg` (driver adapter — NO url in datasource block)
- Self-hosted PostgreSQL (own server)

### MongoDB — Documents
- `category_menus` — Mega-menu (L1→L2→L3 hierarchy)
- `product_details` — Extended attrs, variantOptions, customization configs, printSpecs
- Atlas (SRV resolved via DNS-over-HTTPS trong cả seed và API)

### Redis — Cache & Queue
- BullMQ: email, image, order, scheduled queues
- Cache: mega-menu (10min), autocomplete (5min), shipping
- Self-hosted Redis (khi không có Redis: `DISABLE_QUEUE=true` + ioredis-mock + DevBullModule)

### Cloudflare R2 — Storage
- S3-compatible, CDN public URL

## 5. Services (Self-hosted Production)

| Service | URL |
|---|---|
| API | TBD — set once the server's domain is configured |
| Client | TBD — set once the server's domain is configured |
| Admin | TBD — set once the server's domain is configured |

## 6. Seeded Data

20 sản phẩm, 130 categories (6 L1, ~15 L2, ~60 L3), 10 collections, 2 promotions, 2 shipping zones.

Sản phẩm theo flow:
- **Flow A (CustomizerPanel)**: Coffee Mug, Canvas, Hoodie, Ornament, Phone Case, Throw Pillow, Tote Bag, Pet Portrait, Birth Stats, Cutting Board (personalized), Family Name Sign, Anniversary Map, Couples Mug Set (bundle)
- **Flow B (ComingSoon)**: Graduation Frame, Baby Onesie
- **Flow C (DirectAddToCart)**: Cutting Board (wine glass), Wine Glass, Keychain

## 7. Critical Config Notes

```
# NEXT_PUBLIC_API_URL — KHÔNG có /api/v1 (apiClient tự thêm)
NEXT_PUBLIC_API_URL=https://api.<your-domain>

# CORS_ORIGINS — cần set trong production (API service)
CORS_ORIGINS=https://<your-domain>,https://admin.<your-domain>

# DISABLE_QUEUE=true — dev không có Redis
DISABLE_QUEUE=true
```
