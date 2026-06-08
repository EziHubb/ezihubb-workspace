# Modules 09–14 — Supporting Modules

## Module 09 — Reviews & Ratings

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/products/{slug}/reviews` | Approved reviews for product | No |
| GET | `/api/v1/products/{slug}/reviews/summary` | Review summary (avg, distribution) | No |
| POST | `/api/v1/products/{slug}/reviews` | Tạo review (requires delivered order) | Bearer |
| PATCH | `/api/v1/products/{slug}/reviews/{reviewId}` | Update own pending review | Bearer (owner) |
| DELETE | `/api/v1/products/{slug}/reviews/{reviewId}` | Xoá review | Bearer (owner/admin) |
| POST | `/api/v1/products/{slug}/reviews/{reviewId}/images` | Upload review images (max 5) | Bearer |
| GET | `/api/v1/admin/dashboard/pending-reviews` | Paginated pending reviews | ADMIN |

Admin review moderation is in admin dashboard KPIs.

### Prisma Model
```prisma
enum ReviewStatus { PENDING APPROVED HIDDEN }

model Review {
  id         String       @id @default(cuid())
  userId     String
  productId  String
  orderId    String?
  rating     Int          // 1-5
  title      String?
  body       String?
  imageUrls  String[]
  status     ReviewStatus @default(PENDING)
  adminReply String?
  repliedAt  DateTime?
  createdAt  DateTime     @default(now())
}
```

### Admin UI
File: `apps/admin/src/app/(admin)/reviews/page.tsx`
Components: `ReviewModerationCard.tsx`, `ReviewReplyModal.tsx`

### Business Rules
- Review cần được duyệt (`APPROVED`) trước khi hiển thị public
- User chỉ review 1 lần/product (một orderId valid required for verification)
- Rating aggregate cập nhật trên `Product` (avg, count) khi review approved
- `HIDDEN` status: admin ẩn review không cần xoá
- Admin có thể reply kèm timestamp

---

## Module 10 — Search

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/search` | Full-text search với filters/facets/sort | No |
| GET | `/api/v1/search/autocomplete` | Product name autocomplete (top 8, cached 5 min) | No |
| GET | `/api/v1/search/trending` | Top 10 searched keywords (last 7 days, Redis) | No |
| GET | `/api/v1/search/related` | Related search suggestions | No |

### Query Parameters (GET /search)
| Param | Type | Mô tả |
|---|---|---|
| q | string | Search query (required, max 200) |
| page, limit | number | Pagination |
| category, collection | string | Slug filter |
| tags | string[] | Tag slug filter |
| minPrice, maxPrice | number | Price range |
| minRating | number | Min rating filter |
| itemType | string | `ready_to_ship` \| `to_order` \| `digital` |
| freeShipping, onSale, starSeller | boolean | Special filters |
| colors | string | Comma-separated |
| attr | string | Bracket notation attribute filters |
| sort | SearchSortBy | `relevance`, `newest`, `price_asc`, `price_desc`, `bestseller`, `rating`, `featured` |

### Sort Enum (SearchSortBy)
```typescript
export enum SearchSortBy {
  RELEVANCE  = 'relevance',   // ts_rank DESC (default for search)
  NEWEST     = 'newest',
  PRICE_ASC  = 'price_asc',
  PRICE_DESC = 'price_desc',
  BESTSELLER = 'bestseller',
  RATING     = 'rating',
  FEATURED   = 'featured',
}
```
File: `apps/api/src/modules/search/dto/search-query.dto.ts`

### Implementation
- PostgreSQL full-text search via `plainto_tsquery()`
- Index trên `Product.name`, `Product.description`
- Fallback: ILIKE search khi FTS không có kết quả
- Returns facets (colors, materials, styles, occasions, holidays, recipients)
- `logSearch()` → Redis sorted set for trending
- `computeFacets()` — MongoDB + SQL attribute facets

### Frontend
- Search bar: `apps/client/src/components/search/SearchInput.tsx`
- Results: `apps/client/src/app/[locale]/(storefront)/search/page.tsx`
- Suggestions: debounce 300ms, min 2 chars

---

## Module 11 — Promotions & Promo Codes

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/promotions/validate` | Validate coupon code | Optional |
| POST | `/api/v1/promotions` | Create promotion (admin) | ADMIN |
| GET | `/api/v1/promotions/page-stats` | Promotions dashboard stats | ADMIN |
| GET | `/api/v1/promotions` | List all promotions | ADMIN |
| GET | `/api/v1/promotions/{id}` | Get by ID | ADMIN |
| PUT | `/api/v1/promotions/{id}` | Update promotion | ADMIN |
| PATCH | `/api/v1/promotions/{id}` | Partial update | ADMIN |
| DELETE | `/api/v1/promotions/{id}` | Delete promotion | ADMIN |
| PATCH | `/api/v1/promotions/{id}/deactivate` | Deactivate | ADMIN |
| GET | `/api/v1/promotions/{id}/stats` | Usage stats | ADMIN |

### Prisma Model
```prisma
enum DiscountType { PERCENTAGE FIXED_AMOUNT FREE_SHIPPING }

model Promotion {
  id              String        @id @default(cuid())
  code            String        @unique
  type            DiscountType
  value           Decimal
  minOrderAmount  Decimal?
  maxUses         Int?
  maxUsesPerUser  Int?
  currentUses     Int           @default(0)
  isActive        Boolean       @default(true)
  startsAt        DateTime?
  expiresAt       DateTime?
  description     String?
  createdAt       DateTime      @default(now())
  usages          PromotionUsage[]
}

model PromotionUsage {
  id          String    @id @default(cuid())
  promotionId String
  userId      String
  orderId     String
  usedAt      DateTime  @default(now())
}
```

### Admin UI
File: `apps/admin/src/app/(admin)/promotions/page.tsx`
Components: `PromotionModal.tsx`, `PromotionStatsDrawer.tsx`

### Business Rules
- Code case-insensitive
- Validate: active + date range + usage limit + per-user limit + min order
- `DiscountType.PERCENTAGE`: value = percentage (e.g. 10 = 10%)
- `DiscountType.FIXED_AMOUNT`: value = USD amount
- `DiscountType.FREE_SHIPPING`: shipping cost set to 0
- Discount capped at order subtotal

---

## Module 12 — Shipping

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/shipping/calculate` | Get available shipping options for country + order total | No |
| GET | `/api/v1/shipping/methods` | Active shipping methods for country (`?countryCode=`) | No |

### Prisma Models
```prisma
model ShippingZone {
  id        String           @id @default(cuid())
  name      String
  countries String[]
  methods   ShippingMethod[]
}

model ShippingMethod {
  id               String      @id @default(cuid())
  zoneId           String
  name             String
  carrier          String?
  price            Decimal
  freeShippingOver Decimal?
  minDays          Int
  maxDays          Int
  isActive         Boolean     @default(true)
}
```

Note: Products also have `ShippingProfile` + `ShippingProfileMethod` (per-product shipping overrides managed in admin).

### Admin UI
File: `apps/admin/src/app/(admin)/shipping/page.tsx`
Components: `ShippingZoneModal.tsx`, `ShippingMethodModal.tsx`

---

## Module 13 — Notifications & Email

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/notifications/contact` | Submit contact form message | No |

### Email Service
- Dev: SMTP (MailHog localhost:1025, port 8025 for UI)
- Prod: SendGrid (`SENDGRID_API_KEY`)
- Templates: Handlebars HTML in `apps/api/src/modules/notifications/templates/`
- Env: `EMAIL_FROM`, `EMAIL_FROM_NAME`, `SMTP_HOST`, `SMTP_PORT`

### Email Types
- Welcome email (sau register)
- Email verification
- Password reset
- Order confirmation
- Order status updates (shipped, delivered)
- Order cancelled / refunded
- Admin: new order notification

### Queue (BullMQ)
- Queue name: `email-queue`
- Dev fallback: `DISABLE_QUEUE=true` → DevBullModule (no-op)
- Job retry: 3 lần với exponential backoff
- `apps/api/src/modules/notifications/` module

### Notification Model (Prisma)
```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String
  title     String
  body      String
  data      Json?
  isRead    Boolean  @default(false)
  readAt    DateTime?
  createdAt DateTime @default(now())
}
```

---

## Module 14 — Admin App & Dashboard

### Admin App
- Separate Next.js app: `apps/admin`
- Port: 3001
- Auth: NextAuth.js sessions (same JWT, checks `role === ADMIN || SUPER_ADMIN`)
- Auto-logout on 401 (ApiError class carries HTTP status)

### Dashboard Endpoints
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/admin/dashboard/kpis` | Revenue, orders, customers KPIs |
| GET | `/api/v1/admin/dashboard/revenue` | Daily revenue chart (`?days=7-365`, default 30) |
| GET | `/api/v1/admin/dashboard/orders-by-status` | Order counts by status |
| GET | `/api/v1/admin/dashboard/top-products` | Top products by revenue (`?limit=1-50`) |
| GET | `/api/v1/admin/dashboard/pending-reviews` | Paginated pending reviews |

### Assets / Presign
| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/v1/admin/assets/presign` | Get presigned PUT URLs for direct browser upload to R2 |

### Admin Pages (apps/admin/src/app/(admin)/)
| Page | Path |
|---|---|
| Dashboard | `/dashboard` |
| Products list | `/products` |
| Product new | `/products/new` |
| Product edit | `/products/{id}/edit` |
| Product copy | `/products/copy/{id}` |
| Product SEO | `/products/seo` |
| Orders list | `/orders` |
| Order detail | `/orders/{id}` |
| Customers | `/customers` |
| Customer detail | `/customers/{id}` |
| Payments | `/payments` |
| Reviews | `/reviews` |
| Promotions | `/promotions` |
| Shipping | `/shipping` |
| Settings | `/settings` |
| Catalog: Categories | `/catalog/categories` |
| Catalog: Collections | `/catalog/collections` |

### Guard
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
```

### Key Admin Components
```
apps/admin/src/components/
  products/edit/
    ProductEditShell.tsx          # Main 7-tab form shell
    tabs/                         # PerformanceTab, PhotoVideoTab, ItemDetailsTab,
                                  # ItemOptionsTab, PricingShippingTab, HowItsMadeTab,
                                  # SettingsTab
    ManageVariationsModal.tsx     # Variation group/option CRUD
    CustomOptionsEditor.tsx       # Custom order options CRUD
    GPSRModal.tsx                 # GPSR compliance data
    CategoryPickerModal.tsx       # Category tree picker
    ThumbnailCropModal.tsx        # Thumbnail crop
    helpers.ts                    # buildDefaultValues, extractPrismaFields,
                                  # extractMongoFields, generateSku
  dashboard/
    PendingReviewsCard.tsx, TopProductsTable.tsx
  orders/
    OrderDrawer.tsx, OrderStatusBadge.tsx, CustomizationPreviewModal.tsx
  promotions/
    PromotionModal.tsx, PromotionStatsDrawer.tsx
  reviews/
    ReviewModerationCard.tsx, ReviewReplyModal.tsx
  shipping/
    ShippingZoneModal.tsx, ShippingMethodModal.tsx
```
