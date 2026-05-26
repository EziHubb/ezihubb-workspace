# Database Schema Overview & Project Structure

## 1. Entity Relationship Summary

```
User ──────────────────┬── Address (many)
     │                 ├── WishlistItem (many) ──► Product
     │                 ├── Order (many)
     │                 ├── Review (many) ──────────► Product
     │                 └── Cart (one)

Product ───────────────┬── ProductVariant (many)
        │              ├── ProductImage (many)
        │              ├── Category (one)
        │              ├── CollectionProduct (many) ──► Collection
        │              └── ProductTag (many) ──────────► Tag

Order ─────────────────┬── OrderItem (many) ──────► Product + Variant
      │                ├── Payment (one)
      │                └── OrderStatusHistory (many)

Cart ──────────────────── CartItem (many) ─────────► Product + Variant

Promotion ─────────────── PromotionUsage (many) ──► Order

GiftCard ──────────────── GiftCardUsage (many) ───► Order
```

---

## 2. Nx Workspace Structure

```
mapleloomhandmade/                        ← Nx workspace root
│
├── apps/
│   ├── client/                           ← Next.js 14 — Storefront (customer-facing)
│   │   ├── app/
│   │   │   ├── (storefront)/
│   │   │   │   ├── page.tsx                    # Homepage
│   │   │   │   ├── products/
│   │   │   │   │   ├── page.tsx                # Product listing
│   │   │   │   │   └── [slug]/page.tsx         # Product detail + Customizer
│   │   │   │   ├── collections/[slug]/page.tsx
│   │   │   │   ├── categories/[slug]/page.tsx
│   │   │   │   ├── search/page.tsx
│   │   │   │   ├── cart/page.tsx
│   │   │   │   ├── checkout/
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   └── success/page.tsx
│   │   │   │   ├── orders/
│   │   │   │   │   ├── track/page.tsx          # Guest order tracking
│   │   │   │   │   └── [orderNumber]/page.tsx
│   │   │   │   └── gift-cards/page.tsx
│   │   │   ├── (auth)/
│   │   │   │   ├── login/page.tsx
│   │   │   │   ├── register/page.tsx
│   │   │   │   └── forgot-password/page.tsx
│   │   │   └── (account)/
│   │   │       ├── account/page.tsx            # My Orders
│   │   │       ├── account/orders/[id]/page.tsx
│   │   │       ├── account/wishlist/page.tsx
│   │   │       ├── account/addresses/page.tsx
│   │   │       └── account/settings/page.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Navbar.tsx
│   │   │   │   ├── Footer.tsx
│   │   │   │   └── BottomNav.tsx               # Mobile bottom navigation
│   │   │   ├── product/
│   │   │   │   ├── ProductCard.tsx
│   │   │   │   ├── ProductGrid.tsx
│   │   │   │   ├── ProductGallery.tsx
│   │   │   │   └── VariantPicker.tsx
│   │   │   ├── customizer/
│   │   │   │   ├── Canvas.tsx                  # Fabric.js canvas
│   │   │   │   ├── FieldRenderer.tsx
│   │   │   │   ├── ImageUploader.tsx
│   │   │   │   ├── StylePicker.tsx
│   │   │   │   └── PreviewModal.tsx
│   │   │   ├── cart/
│   │   │   │   ├── CartDrawer.tsx
│   │   │   │   └── CartItem.tsx
│   │   │   ├── checkout/
│   │   │   │   ├── StepIndicator.tsx
│   │   │   │   ├── ShippingForm.tsx
│   │   │   │   └── PaymentForm.tsx
│   │   │   └── ui/                             # Local UI overrides (uses shared/ui)
│   │   ├── lib/
│   │   │   ├── api.ts                          # API client (uses shared/api-client)
│   │   │   └── store/
│   │   │       ├── cart.store.ts               # Zustand
│   │   │       └── customizer.store.ts
│   │   ├── public/
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── project.json                        ← Nx project config
│   │   └── tsconfig.json
│   │
│   ├── admin/                            ← Next.js 14 — Admin Dashboard
│   │   ├── app/
│   │   │   ├── layout.tsx                      # Admin shell (sidebar + topbar)
│   │   │   ├── page.tsx                        # Redirect → /dashboard
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── orders/
│   │   │   │   ├── page.tsx                    # Orders list
│   │   │   │   └── [id]/page.tsx               # Order detail
│   │   │   ├── products/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/edit/page.tsx
│   │   │   ├── catalog/
│   │   │   │   ├── categories/page.tsx
│   │   │   │   └── collections/page.tsx
│   │   │   ├── customers/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── promotions/page.tsx
│   │   │   ├── reviews/page.tsx
│   │   │   ├── shipping/page.tsx
│   │   │   ├── payments/page.tsx
│   │   │   └── settings/page.tsx
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AdminSidebar.tsx
│   │   │   │   └── AdminTopbar.tsx
│   │   │   ├── orders/
│   │   │   │   ├── OrderTable.tsx
│   │   │   │   ├── OrderDrawer.tsx
│   │   │   │   └── StatusTimeline.tsx
│   │   │   ├── products/
│   │   │   │   ├── ProductForm.tsx
│   │   │   │   └── VariantEditor.tsx
│   │   │   ├── charts/
│   │   │   │   ├── RevenueChart.tsx
│   │   │   │   └── OrdersDonut.tsx
│   │   │   └── ui/
│   │   ├── lib/
│   │   │   └── api.ts
│   │   ├── next.config.js
│   │   ├── tailwind.config.js
│   │   ├── project.json                        ← Nx project config
│   │   └── tsconfig.json
│   │
│   └── api/                              ← NestJS — REST API
│       ├── src/
│       │   ├── main.ts
│       │   ├── app.module.ts
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   │   ├── auth.module.ts
│       │   │   │   ├── auth.controller.ts
│       │   │   │   ├── auth.service.ts
│       │   │   │   ├── strategies/
│       │   │   │   │   ├── jwt.strategy.ts
│       │   │   │   │   ├── jwt-refresh.strategy.ts
│       │   │   │   │   └── google.strategy.ts
│       │   │   │   └── dto/
│       │   │   │       ├── register.dto.ts
│       │   │   │       ├── login.dto.ts
│       │   │   │       └── reset-password.dto.ts
│       │   │   ├── users/
│       │   │   │   ├── users.module.ts
│       │   │   │   ├── users.controller.ts
│       │   │   │   ├── users.service.ts
│       │   │   │   └── dto/
│       │   │   ├── catalog/
│       │   │   │   ├── catalog.module.ts
│       │   │   │   ├── categories.controller.ts
│       │   │   │   ├── collections.controller.ts
│       │   │   │   └── catalog.service.ts
│       │   │   ├── products/
│       │   │   │   ├── products.module.ts
│       │   │   │   ├── products.controller.ts
│       │   │   │   ├── products.service.ts
│       │   │   │   └── dto/
│       │   │   ├── customization/
│       │   │   │   ├── customization.module.ts
│       │   │   │   ├── customization.controller.ts
│       │   │   │   ├── customization.service.ts
│       │   │   │   └── image-processing.service.ts
│       │   │   ├── cart/
│       │   │   ├── orders/
│       │   │   ├── payments/
│       │   │   │   ├── payments.module.ts
│       │   │   │   ├── payments.controller.ts
│       │   │   │   ├── payments.service.ts
│       │   │   │   └── webhooks.controller.ts
│       │   │   ├── shipping/
│       │   │   ├── reviews/
│       │   │   ├── promotions/
│       │   │   ├── notifications/
│       │   │   │   ├── notifications.module.ts
│       │   │   │   ├── notifications.service.ts
│       │   │   │   └── templates/
│       │   │   │       ├── order-confirmation.hbs
│       │   │   │       ├── order-shipped.hbs
│       │   │   │       └── review-reminder.hbs
│       │   │   ├── search/
│       │   │   └── admin/
│       │   │       ├── admin.module.ts
│       │   │       └── admin.controller.ts
│       │   ├── common/
│       │   │   ├── guards/
│       │   │   │   ├── jwt-auth.guard.ts
│       │   │   │   ├── roles.guard.ts
│       │   │   │   └── throttler.guard.ts
│       │   │   ├── decorators/
│       │   │   │   ├── roles.decorator.ts
│       │   │   │   ├── current-user.decorator.ts
│       │   │   │   └── public.decorator.ts
│       │   │   ├── interceptors/
│       │   │   │   ├── response.interceptor.ts   # Envelope wrapper
│       │   │   │   ├── logging.interceptor.ts
│       │   │   │   └── cache.interceptor.ts
│       │   │   ├── filters/
│       │   │   │   └── http-exception.filter.ts
│       │   │   └── pipes/
│       │   │       └── validation.pipe.ts
│       │   ├── config/
│       │   │   ├── app.config.ts
│       │   │   ├── database.config.ts
│       │   │   ├── jwt.config.ts
│       │   │   ├── redis.config.ts
│       │   │   └── storage.config.ts
│       │   ├── queue/
│       │   │   ├── queue.module.ts
│       │   │   ├── email.processor.ts
│       │   │   ├── image.processor.ts
│       │   │   └── order.processor.ts
│       │   └── prisma/
│       │       ├── prisma.module.ts
│       │       ├── prisma.service.ts
│       │       └── schema.prisma
│       ├── test/
│       ├── project.json                        ← Nx project config
│       └── tsconfig.json
│
├── libs/                               ← Shared libraries (dùng chung giữa apps)
│   ├── shared/
│   │   ├── types/                      ← TypeScript interfaces & types
│   │   │   ├── src/
│   │   │   │   ├── user.types.ts
│   │   │   │   ├── product.types.ts
│   │   │   │   ├── order.types.ts
│   │   │   │   ├── cart.types.ts
│   │   │   │   ├── payment.types.ts
│   │   │   │   └── index.ts
│   │   │   └── project.json
│   │   ├── constants/                  ← Shared constants
│   │   │   ├── src/
│   │   │   │   ├── order-status.ts
│   │   │   │   ├── roles.ts
│   │   │   │   ├── routes.ts           # API route constants
│   │   │   │   └── index.ts
│   │   │   └── project.json
│   │   └── api-client/                 ← Generated API client (openapi-fetch)
│   │       ├── src/
│   │       │   ├── client.ts
│   │       │   └── index.ts
│   │       └── project.json
│   └── ui/                             ← Shared React component library
│       ├── src/
│       │   ├── components/
│       │   │   ├── Button/
│       │   │   │   ├── Button.tsx
│       │   │   │   └── Button.stories.tsx
│       │   │   ├── Input/
│       │   │   ├── Badge/
│       │   │   ├── Modal/
│       │   │   ├── Toast/
│       │   │   ├── Skeleton/
│       │   │   └── index.ts
│       │   └── index.ts
│       ├── tailwind.config.js          # Source of truth for design tokens
│       └── project.json
│
├── tools/
│   └── generators/                     ← Custom Nx generators
│       ├── module/                     # Generate NestJS module boilerplate
│       └── page/                       # Generate Next.js page boilerplate
│
├── prisma/                             ← Prisma ở root, share cho api app
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
│
├── docker/
│   ├── Dockerfile.client
│   ├── Dockerfile.admin
│   ├── Dockerfile.api
│   └── nginx.conf
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── docker-compose.yml                  ← Local dev: postgres + redis + apps
├── docker-compose.prod.yml
├── nx.json                             ← Nx workspace config
├── package.json                        ← Root package.json (single node_modules)
├── tsconfig.base.json                  ← Path aliases cho toàn workspace
├── .env                                ← Local env (gitignored)
├── .env.example
└── .eslintrc.json
```

---

## 3. Nx Configuration

### `nx.json`
```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "defaultBase": "main",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/*.spec.ts",
      "!{projectRoot}/jest.config.ts"
    ],
    "sharedGlobals": []
  },
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"],
      "cache": true
    },
    "test": { "cache": true },
    "lint": { "cache": true }
  },
  "plugins": [
    "@nx/next",
    "@nx/nest",
    "@nx/eslint"
  ]
}
```

### `tsconfig.base.json` — Path Aliases
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@mlh/types":          ["libs/shared/types/src/index.ts"],
      "@mlh/constants":      ["libs/shared/constants/src/index.ts"],
      "@mlh/api-client":     ["libs/shared/api-client/src/index.ts"],
      "@mlh/ui":             ["libs/ui/src/index.ts"]
    }
  }
}
```

### `apps/client/project.json`
```json
{
  "name": "client",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/client",
  "projectType": "application",
  "targets": {
    "build":  { "executor": "@nx/next:build" },
    "serve":  { "executor": "@nx/next:server",
                "options": { "port": 3000, "hostname": "localhost" } },
    "lint":   { "executor": "@nx/eslint:lint" },
    "test":   { "executor": "@nx/jest:jest" }
  },
  "tags": ["scope:client", "type:app"]
}
```

### `apps/admin/project.json`
```json
{
  "name": "admin",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/admin",
  "projectType": "application",
  "targets": {
    "build":  { "executor": "@nx/next:build" },
    "serve":  { "executor": "@nx/next:server",
                "options": { "port": 3001, "hostname": "localhost" } },
    "lint":   { "executor": "@nx/eslint:lint" },
    "test":   { "executor": "@nx/jest:jest" }
  },
  "tags": ["scope:admin", "type:app"]
}
```

### `apps/api/project.json`
```json
{
  "name": "api",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/api/src",
  "projectType": "application",
  "targets": {
    "build":  { "executor": "@nx/webpack:webpack",
                "options": { "outputPath": "dist/apps/api" } },
    "serve":  { "executor": "@nx/js:node",
                "options": { "buildTarget": "api:build", "port": 3002 } },
    "lint":   { "executor": "@nx/eslint:lint" },
    "test":   { "executor": "@nx/jest:jest" }
  },
  "tags": ["scope:api", "type:app"]
}
```

---

## 4. Dev Ports

| App | Port | URL |
|-----|------|-----|
| `client` (Storefront) | 3000 | http://localhost:3000 |
| `admin` (Dashboard) | 3001 | http://localhost:3001 |
| `api` (NestJS) | 3002 | http://localhost:3002 |
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |

---

## 5. Nx Commands

```bash
# Khởi tạo workspace
npx create-nx-workspace@latest mapleloomhandmade \
  --preset=empty --packageManager=pnpm

# Thêm plugins
pnpm nx add @nx/next @nx/nest @nx/js

# Generate apps
pnpm nx g @nx/next:app client --directory=apps/client --appDir --src
pnpm nx g @nx/next:app admin  --directory=apps/admin  --appDir --src
pnpm nx g @nx/nest:app api    --directory=apps/api

# Generate shared libs
pnpm nx g @nx/js:lib shared-types     --directory=libs/shared/types
pnpm nx g @nx/js:lib shared-constants --directory=libs/shared/constants
pnpm nx g @nx/js:lib api-client       --directory=libs/shared/api-client
pnpm nx g @nx/react:lib ui            --directory=libs/ui --bundler=vite

# Chạy dev (tất cả apps song song)
pnpm nx run-many -t serve -p client admin api

# Chạy từng app
pnpm nx serve client   # → localhost:3000
pnpm nx serve admin    # → localhost:3001
pnpm nx serve api      # → localhost:3002

# Build tất cả (tự tính dependency order)
pnpm nx run-many -t build

# Build 1 app (tự build dependencies trước)
pnpm nx build client

# Test affected (chỉ test những gì thay đổi)
pnpm nx affected -t test

# Lint affected
pnpm nx affected -t lint

# Xem dependency graph
pnpm nx graph

# Generate NestJS module mới (custom generator)
pnpm nx g @mlh/generators:module products --app=api
```

---

## 6. `docker-compose.yml` (Local Dev)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: mapleloomhandmade
      POSTGRES_USER: mlh
      POSTGRES_PASSWORD: mlh_secret
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data

  client:
    build:
      context: .
      dockerfile: docker/Dockerfile.client
    ports:
      - '3000:3000'
    environment:
      - NEXT_PUBLIC_API_URL=http://api:3002
    depends_on:
      - api

  admin:
    build:
      context: .
      dockerfile: docker/Dockerfile.admin
    ports:
      - '3001:3001'
    environment:
      - NEXT_PUBLIC_API_URL=http://api:3002
    depends_on:
      - api

  api:
    build:
      context: .
      dockerfile: docker/Dockerfile.api
    ports:
      - '3002:3002'
    environment:
      - DATABASE_URL=postgresql://mlh:mlh_secret@postgres:5432/mapleloomhandmade
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

volumes:
  postgres_data:
  redis_data:
```

---

## 7. Environment Variables

```bash
# ─── Database ────────────────────────────────
DATABASE_URL="postgresql://mlh:mlh_secret@localhost:5432/mapleloomhandmade"
REDIS_URL="redis://localhost:6379"

# ─── Auth ────────────────────────────────────
JWT_ACCESS_SECRET="..."
JWT_REFRESH_SECRET="..."
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="30d"

# ─── Google OAuth ─────────────────────────────
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
GOOGLE_CALLBACK_URL="http://localhost:3002/auth/google/callback"

# ─── Storage (S3 / Cloudflare R2) ────────────
AWS_S3_BUCKET="mlh-assets"
AWS_S3_REGION="us-east-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
CDN_URL="https://cdn.mapleloomhandmade.com"

# ─── Payments ─────────────────────────────────
STRIPE_SECRET_KEY="sk_..."
STRIPE_WEBHOOK_SECRET="whsec_..."
PAYPAL_CLIENT_ID="..."
PAYPAL_CLIENT_SECRET="..."

# ─── Email ────────────────────────────────────
SMTP_HOST="smtp.sendgrid.net"
SMTP_PORT=587
SMTP_USER="apikey"
SMTP_PASS="SG...."
EMAIL_FROM="noreply@mapleloomhandmade.com"

# ─── AI Services ──────────────────────────────
BG_REMOVAL_API_URL="..."
BG_REMOVAL_API_KEY="..."

# ─── Client App (Next.js public) ──────────────
NEXT_PUBLIC_API_URL="http://localhost:3002"
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_..."
NEXT_PUBLIC_CDN_URL="https://cdn.mapleloomhandmade.com"

# ─── Admin App (Next.js public) ───────────────
NEXT_PUBLIC_API_URL="http://localhost:3002"

# ─── API App (NestJS internal) ────────────────
PORT=3002
NODE_ENV=development
CORS_ORIGINS="http://localhost:3000,http://localhost:3001"
```

---

## 8. Tech Stack Summary

| Layer | Technology |
|-------|------------|
| **Monorepo** | Nx 19, pnpm workspaces |
| **Storefront** | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| **Admin** | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| **API** | NestJS 10, TypeScript, Passport.js |
| **Shared UI** | React component lib (`libs/ui`) |
| **Shared Types** | TypeScript interfaces (`libs/shared/types`) |
| **Canvas/Customizer** | Fabric.js (client app only) |
| **State Management** | Zustand (client), React Query (client + admin) |
| **ORM** | Prisma 5 |
| **Database** | PostgreSQL 15 |
| **Cache / Queue** | Redis 7 + BullMQ |
| **Storage** | Cloudflare R2 (S3-compatible) |
| **Image Processing** | Sharp |
| **Email** | Nodemailer + Handlebars |
| **Payment** | Stripe + PayPal SDK |
| **Auth** | JWT (access + refresh) + Google OAuth 2.0 |
| **Container** | Docker + docker-compose |
| **CI/CD** | GitHub Actions + Nx affected |
| **Package Manager** | pnpm |

---

## 9. Nx Project Dependency Graph

```
apps/client  ──────┬──► libs/ui
                   ├──► libs/shared/types
                   └──► libs/shared/api-client

apps/admin   ──────┬──► libs/ui
                   ├──► libs/shared/types
                   └──► libs/shared/api-client

apps/api     ──────┬──► libs/shared/types
                   └──► libs/shared/constants

libs/shared/api-client ──► libs/shared/types
libs/ui                ──► libs/shared/types
```

Nx enforce boundary rules qua tags:
- `scope:client` chỉ import `libs/` — không import từ `scope:admin` hay `scope:api`
- `scope:admin` chỉ import `libs/` — không import từ `scope:client`
- `scope:api` chỉ import `libs/shared/types` và `libs/shared/constants`
- Không app nào import trực tiếp từ app khác

---

## 10. Development Phases

| Phase | Scope | Targets |
|-------|-------|---------|
| **Phase 1 — Foundation** | 1 tuần | Nx setup, libs scaffold, Prisma schema, Docker |
| **Phase 2 — Core API** | 3–4 tuần | Auth, Users, Products, Catalog, Cart, Orders, Payments |
| **Phase 3 — Client UI** | 3–4 tuần | Homepage, Listing, Product Detail, Cart, Checkout, Auth pages |
| **Phase 4 — Customizer** | 2–3 tuần | Canvas editor, Image upload, AI remove BG, Preview gen |
| **Phase 5 — Admin UI** | 2–3 tuần | Dashboard, Orders, Products, Customers, Promotions |
| **Phase 6 — Ops** | 2 tuần | Shipping, Reviews, Notifications, Search |
| **Phase 7 — Polish** | 2 tuần | SEO, Performance, Analytics, A/B test |
