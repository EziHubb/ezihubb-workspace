# Modules 09–14 — Supporting Modules

## Module 09 — Reviews & Ratings

### Endpoints (Customer)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/products/{slug}/reviews` | Approved reviews for product (paginated) | No |
| GET | `/api/v1/products/{slug}/reviews/summary` | Review summary (avg, distribution) | No |
| GET | `/api/v1/products/{slug}/reviews/my-review` | Current user's own review | Bearer |
| POST | `/api/v1/products/{slug}/reviews` | Tạo review (requires delivered/completed order) | Bearer |
| PATCH | `/api/v1/products/{slug}/reviews/{reviewId}` | Update own pending review | Bearer |
| DELETE | `/api/v1/products/{slug}/reviews/{reviewId}` | Delete own review | Bearer |
| POST | `/api/v1/products/{slug}/reviews/{reviewId}/helpful` | Mark review as helpful (anonymous) | No |
| POST | `/api/v1/products/{slug}/reviews/{reviewId}/images` | Upload review images (max 5, max 5 MB each) | Bearer |

### Endpoints (Global — `/reviews`, không gắn với 1 product cụ thể)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/reviews` | List tất cả review đã approve (global, phân trang) | No |
| GET | `/api/v1/reviews/summary` | Review summary toàn site (avg + distribution) | No |
| GET | `/api/v1/reviews/me/reviewable-products` | Sản phẩm từ đơn delivered chưa review | Bearer |
| GET | `/api/v1/reviews/can-review` | Kiểm tra user có được review 1 product không (`?productId=`) | Optional |
| POST | `/api/v1/reviews/upload-image` | Upload ảnh review độc lập (trả về CDN URL) | Optional |

File: `apps/api/src/modules/reviews/public-reviews.controller.ts`

### Endpoints (Admin)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/reviews/counts` | Count reviews grouped by status (for tab badges) | ADMIN |
| GET | `/api/v1/admin/reviews` | List all reviews (filterable by status) | ADMIN |
| DELETE | `/api/v1/admin/reviews/{reviewId}` | Permanently delete a review | ADMIN |
| POST | `/api/v1/admin/reviews/{reviewId}/approve` | Approve pending review | ADMIN |
| POST | `/api/v1/admin/reviews/{reviewId}/hide` | Hide a review (without deleting) | ADMIN |
| POST | `/api/v1/admin/reviews/{reviewId}/reply` | Add/update admin reply | ADMIN |

### Prisma Model
```prisma
enum ReviewStatus { PENDING APPROVED HIDDEN }

model Review {
  id          String       @id @default(cuid())
  userId      String
  productId   String
  orderId     String?
  rating      Int          // 1-5
  title       String?
  body        String?
  imageUrls   String[]
  status      ReviewStatus @default(PENDING)
  helpfulCount Int         @default(0)
  adminReply  String?
  repliedAt   DateTime?
  createdAt   DateTime     @default(now())
}
```

### Admin UI
File: `apps/admin/src/app/(admin)/reviews/page.tsx`
Components: `ReviewModerationCard.tsx`, `ReviewReplyModal.tsx`

### Admin Store Scoping (`resolveSellerStoreId`)
Admin review endpoints use `resolveSellerStoreId()` to scope data:
- `SUPER_ADMIN` → `storeId = null` (sees all stores)
- `ADMIN` role → looks up `user.storeId` from DB → only sees own store's data

```typescript
async function resolveSellerStoreId(prisma: PrismaService, user: JwtLike): Promise<string | null> {
  if (user.role === 'SUPER_ADMIN') return null;
  const userId = user.sub ?? user.id;
  if (!userId) return null;
  const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { storeId: true } });
  return dbUser?.storeId ?? null;
}
```
Same pattern applied to: admin-messages, admin-promotions, admin-shipping controllers.

### Business Rules
- Review cần `APPROVED` trước khi hiển thị public
- User chỉ review 1 lần/product (verified via delivered/completed `orderId`)
- Rating aggregate cập nhật trên `Product` (avg, count) khi review approved
- `HIDDEN`: admin ẩn mà không xoá
- Image upload: max 5 images, max 5 MB each, accepted types: jpeg/jpg/png/webp
- `helpful` endpoint: anonymous, one increment per call (no dedup)
- Admin `GET /admin/reviews/counts` returns counts per status for tab badges

---

## Module 10 — Search

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/search` | Full-text search với filters/facets/sort | No |
| GET | `/api/v1/search/autocomplete` | Product name autocomplete (top 8, cached 5 min) | No |
| GET | `/api/v1/search/trending` | Top 10 searched keywords (last 7 days, Redis) | No |
| GET | `/api/v1/search/related` | Related search suggestions based on trending data | No |
| GET | `/api/v1/search/suggestions` | Combined autocomplete + related (deduped, max 10) | No |

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
- Index on `Product.name`, `Product.description`
- Fallback: ILIKE search when FTS returns no results
- Returns facets (colors, materials, styles, occasions, holidays, recipients)
- `logSearch()` → Redis sorted set for trending
- `computeFacets()` — combines SQL + MongoDB attribute facets

### Frontend
- Search bar: `apps/client/src/components/search/SearchInput.tsx`
- Results: `apps/client/src/app/[locale]/(storefront)/search/page.tsx`
- Suggestions: debounce 300ms, min 2 chars

---

## Module 11 — Promotions & Promo Codes

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/promotions/validate` | Validate coupon code (does not consume it) | Optional |
| POST | `/api/v1/promotions` | Create promotion | ADMIN |
| GET | `/api/v1/promotions/page-stats` | Promotions dashboard aggregate stats | ADMIN |
| GET | `/api/v1/promotions` | List all promotions (paginated) | ADMIN |
| GET | `/api/v1/promotions/{id}` | Get by ID | ADMIN |
| PUT | `/api/v1/promotions/{id}` | Full update | ADMIN |
| PATCH | `/api/v1/promotions/{id}` | Partial update (incl. `isActive` toggle) | ADMIN |
| DELETE | `/api/v1/promotions/{id}` | Delete promotion | ADMIN |
| PATCH | `/api/v1/promotions/{id}/deactivate` | Deactivate | ADMIN |
| GET | `/api/v1/promotions/{id}/stats` | Usage statistics | ADMIN |

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

### Admin Store Scoping
Promotions admin controller uses `resolveSellerStoreId()` — ADMIN role only sees own store's promotions; SUPER_ADMIN sees all.

### Business Rules
- Code case-insensitive
- Validate: active + date range + usage limit + per-user limit + min order
- `PERCENTAGE`: value = percentage (e.g. 10 = 10%)
- `FIXED_AMOUNT`: value = USD amount
- `FREE_SHIPPING`: shipping cost set to 0
- Discount capped at order subtotal
- `validate` endpoint: does NOT consume the coupon, auth optional (per-user limit check uses `userId` when available)

---

## Module 12 — Shipping

### Public Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/shipping/calculate` | Get shipping options for country + order total | No |
| GET | `/api/v1/shipping/methods` | Active methods for country (`?countryCode=`) | No |

### Admin Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/shipping/processing-profiles` | List processing profiles | ADMIN |
| GET | `/api/v1/admin/shipping/profiles` | List shipping profiles with methods | ADMIN |
| GET | `/api/v1/admin/shipping/zones` | List all zones with methods | ADMIN |
| GET | `/api/v1/admin/shipping/zones/{id}` | Get zone by ID | ADMIN |
| POST | `/api/v1/admin/shipping/zones` | Create shipping zone | ADMIN |
| PUT | `/api/v1/admin/shipping/zones/{id}` | Update shipping zone | ADMIN |
| DELETE | `/api/v1/admin/shipping/zones/{id}` | Delete zone + all methods | ADMIN |
| GET | `/api/v1/admin/shipping/zones/{zoneId}/methods` | List methods for a zone | ADMIN |
| POST | `/api/v1/admin/shipping/zones/{zoneId}/methods` | Add method to zone | ADMIN |
| PUT | `/api/v1/admin/shipping/methods/{id}` | Update method | ADMIN |
| DELETE | `/api/v1/admin/shipping/methods/{id}` | Delete method | ADMIN |
| GET | `/api/v1/admin/shipping/settings` | Get shipping settings | ADMIN |
| PATCH | `/api/v1/admin/shipping/settings` | Update shipping settings | ADMIN |

### Carrier Label Purchase (Admin — on Order)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/orders/{id}/rates` | Get EasyPost rates (no charge) | ADMIN |
| POST | `/api/v1/admin/orders/{id}/buy-label` | Purchase label (irreversible) | ADMIN |

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

Also: Products have `ShippingProfile` + `ShippingProfileMethod` for per-product shipping overrides.

### EasyPost Integration (`LabelService`)
File: `apps/api/src/modules/shipping/label.service.ts`
- axios-based (no EasyPost SDK)
- `EASYPOST_API_KEY` required; logs warning if unset
- `fromAddress` configured via env vars (`WAREHOUSE_NAME`, `WAREHOUSE_STREET`, etc.)
- `getRates(orderId)` → creates EasyPost shipment, returns rates
- `purchaseLabel(orderId, rateId)` → buys label, updates order tracking fields

### EasyPost Tracking Webhook
```
POST /api/v1/webhooks/easypost
```
File: `apps/api/src/modules/shipping/tracking-webhook.controller.ts`
- HMAC-SHA256 via `X-Hmac-Signature` (key: `EASYPOST_WEBHOOK_SECRET`)
- On `delivered` event: auto-updates order to `DELIVERED`, sends delivery email
- `TrackingService` also detects carrier from tracking number pattern (USPS/UPS/FedEx/DHL)

### Admin Store Scoping
Admin shipping controller uses `resolveSellerStoreId()` — ADMIN role only sees shipping settings for their own store; SUPER_ADMIN sees all.

### Admin UI
File: `apps/admin/src/app/(admin)/shipping/page.tsx`
Components: `ShippingZoneModal.tsx`, `ShippingMethodModal.tsx`, `BuyLabelModal.tsx`

---

## Module 13 — Notifications & Email

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/notifications/contact` | Submit contact form message | No |
| POST | `/api/v1/notifications/product-ready` | Subscribe to product availability notification | No |
| POST | `/api/v1/notifications/newsletter` | Subscribe to newsletter | No |
| POST | `/api/v1/newsletter/subscribe` | Subscribe to newsletter (canonical path) | No |

### Email Service
- Dev: SMTP (MailHog localhost:1025, port 8025 for UI)
- Prod: SendGrid (`SENDGRID_API_KEY`)
- Templates: Handlebars HTML in `apps/api/src/modules/notifications/templates/`
- Env: `EMAIL_FROM`, `EMAIL_FROM_NAME`, `SMTP_HOST`, `SMTP_PORT`

### Email Types
- Welcome email (after register)
- Email verification
- Password reset
- Order confirmation
- Order status updates (shipped, delivered)
- Order cancelled / refunded
- Admin: new order notification
- Contact form submission forwarded to admin
- Product availability subscription confirmation

### Queue (BullMQ)
- Queue name: `email-queue` (`QUEUES.EMAIL`)
- Dev fallback: `DISABLE_QUEUE=true` → DevBullModule (no-op)
- Job retry: 3 times with exponential backoff
- Module: `apps/api/src/modules/notifications/`

### FCM Push Notifications
File: `apps/api/src/modules/notifications/fcm.service.ts`, `push.service.ts`
- `firebase-admin` SDK
- `pushService.sendToUser(userId, { title, body, data })`
- Queue: `push-notification-queue`
- See: `24_fcm_low_stock.spec.md`

### Notification Model (Prisma)
```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String?  // null for anonymous (e.g. product-ready without account)
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
- Auto-logout on 401 (`ApiError` class carries HTTP status)

### Dashboard Endpoints
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/admin/dashboard/kpis` | Revenue, orders, customers KPIs |
| GET | `/api/v1/admin/dashboard/revenue` | Daily revenue chart (`?days=7-365`, default 30) |
| GET | `/api/v1/admin/dashboard/orders-by-status` | Order counts by status |
| GET | `/api/v1/admin/dashboard/top-products` | Top products by revenue (`?limit=1-50`) |
| GET | `/api/v1/admin/dashboard/platform` | Platform-wide stats (stores, products, revenue) |
| GET | `/api/v1/admin/dashboard/activity` | Recent platform activity feed |
| GET | `/api/v1/admin/dashboard/top-stores` | Top stores by revenue (`?limit=`, default 5) |
| GET | `/api/v1/admin/dashboard/pending-reviews` | Paginated pending reviews |

### Assets / Presign
| Method | Path | Mô tả |
|---|---|---|
| POST | `/api/v1/admin/assets/presign` | Get presigned PUT URLs for direct browser upload to R2 |

### Guard Pattern
All admin controllers use `@AdminController('path')` composite decorator:
```typescript
// Automatically applies:
Controller('admin/path')
UseGuards(JwtAuthGuard, RolesGuard)
Roles(Role.ADMIN, Role.SUPER_ADMIN)
ApiBearerAuth()
ApiTags('Admin — Path')
```

### Admin Pages (Complete — apps/admin/src/app/(admin)/)

See full list in `29_admin_extended.spec.md`. Core pages:

| Page | Path |
|---|---|
| Dashboard | `/dashboard` |
| Products list | `/products` |
| Product new | `/products/new` |
| Product edit | `/products/{id}/edit` |
| Product copy | `/products/copy/{id}` |
| Product SEO | `/products/seo` |
| Product CSV import | `/products/import` |
| Orders list | `/orders` |
| Order detail | `/orders/{id}` |
| Customers | `/customers` |
| Customer detail | `/customers/{id}` |
| Messages inbox | `/messages` |
| Payments | `/payments` |
| Reviews | `/reviews` |
| Promotions | `/promotions` |
| Shipping | `/shipping` |
| Affiliates | `/affiliates` |
| Creators | `/creators` |
| Referrals | `/referrals` |
| Catalog: Categories | `/catalog/categories` |
| Catalog: Collections | `/catalog/collections` |
| Settings: General | `/settings` |
| Settings: Team | `/settings/team` |
| Settings: Email Templates | `/settings/email-templates` |
| Settings: Audit Log | `/settings/audit-log` |
| Moderation | `/moderation` |

### Key Admin Components
```
apps/admin/src/components/
  products/edit/
    ProductEditShell.tsx          # Main 8-tab form shell (+ Translations tab)
    tabs/                         # PerformanceTab, PhotoVideoTab, ItemDetailsTab,
                                  # ItemOptionsTab, PricingShippingTab, HowItsMadeTab,
                                  # SettingsTab, QaTab, TranslationsTab
    ManageVariationsModal.tsx     # Variation group/option CRUD
    CustomOptionsEditor.tsx       # Custom order options CRUD
    GPSRModal.tsx                 # GPSR compliance data
    CategoryPickerModal.tsx       # Category tree picker
    ThumbnailCropModal.tsx        # Thumbnail crop
    BulkActionBar.tsx             # Bulk publish/unpublish/archive/sale/export
    helpers.ts                    # buildDefaultValues, extractPrismaFields,
                                  # extractMongoFields, generateSku
  dashboard/
    PendingReviewsCard.tsx, TopProductsTable.tsx, AiKpiRow.tsx
  orders/
    OrderDrawer.tsx, OrderStatusBadge.tsx, CustomizationPreviewModal.tsx
    BuyLabelModal.tsx             # EasyPost label purchase
  messages/
    MessageList.tsx, MessageThread.tsx, ReplyForm.tsx
  promotions/
    PromotionModal.tsx, PromotionStatsDrawer.tsx
  reviews/
    ReviewModerationCard.tsx, ReviewReplyModal.tsx
  shipping/
    ShippingZoneModal.tsx, ShippingMethodModal.tsx
  affiliates/
    AffiliateTable.tsx, AffiliateDetailModal.tsx
  creators/
    CreatorTable.tsx, CreatorApplicationModal.tsx
```

---

## Module 16 — Tax

### Endpoint
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/orders/tax-preview` | Preview tax for address + cart total (US only) | No |

File: `apps/api/src/modules/tax/tax.service.ts`

### TaxPreviewDto
```typescript
interface TaxPreviewDto {
  postalCode: string;
  state: string;
  country: string;  // only 'US' supported
  subtotal: number;
  shippingCost: number;
}

// Response: TaxCalculation
interface TaxCalculation {
  taxAmount: number;
  taxRate: number;
  jurisdiction: string;
  breakdown?: {
    stateTax: number;
    countyTax: number;
    cityTax: number;
    specialTax: number;
  };
}
```

### Implementation
- Primary: TaxJar API (`TAXJAR_API_KEY`) — real nexus-based calculation
- Fallback: static `STATE_RATES` lookup table (average state rates, not compliance-grade)
- Redis cache for TaxJar results
- US only — non-US orders return `{ taxAmount: 0, taxRate: 0, jurisdiction: 'N/A' }`

---

## Module 17 — Messages System

**See dedicated spec: `21_messages.spec.md`**

Summary: Full messaging system between customers and admin. 9 endpoints. Customer inbox at `/account/messages`, admin inbox at `/messages`. Email notifications on both sides.

---

## Module 19 — Stores

### Public Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/stores` | Paginated list of active stores (sorted by rating, `?page=&limit=12`) | No |
| GET | `/api/v1/stores/plans` | Active seller subscription plans | No |
| GET | `/api/v1/stores/{slug}` | Store detail page data by slug | No |
| GET | `/api/v1/stores/{slug}/sections` | Product category sections with product counts | No |
| GET | `/api/v1/stores/{slug}/score` | Store performance score / metrics | No |
| GET | `/api/v1/stores/{slug}/reviews/summary` | Store reviews aggregate (avg + distribution) | No |
| GET | `/api/v1/stores/{slug}/reviews` | Paginated store reviews (sort: newest/price_asc/price_desc/popular) | No |

### Seller Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/stores/apply` | Apply to open a new store | Bearer |
| GET | `/api/v1/stores/me` | Seller's own store info | Bearer |
| GET | `/api/v1/stores/me/application` | Get own store application status | Bearer |
| PATCH | `/api/v1/stores/me` | Update own store profile (ACTIVE stores only) | Bearer |

### Business Rules
- `GET /stores` returns only `status: ACTIVE` stores, paginated (max 50 per page), ordered by rating desc
- Store reviews sort enum: `newest` | `price_asc` | `price_desc` | `popular` (all lowercase)
- File: `apps/api/src/modules/stores/`

### Frontend
- `/[locale]/shops/[slug]` — Store detail with tabs: Featured / All / Reviews / About
- `StorePageClient.tsx` — Client component handling tab switching
- `StoreReviewsClient.tsx` — Handles reviews tab with sort

### Admin Endpoints (Store/Marketplace Management)
File: `apps/api/src/modules/stores/admin-stores.controller.ts` — ADMIN role scoped to own store (via `scopedOwnerId`), SUPER_ADMIN sees all.

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/admin/stores` | List stores (filterable) |
| GET | `/api/v1/admin/stores/{id}` | Store detail |
| POST | `/api/v1/admin/stores/{id}/approve` | Approve store application |
| POST | `/api/v1/admin/stores/{id}/reject` | Reject application |
| POST | `/api/v1/admin/stores/{id}/suspend` | Suspend store |
| PATCH | `/api/v1/admin/stores/{id}` | Update store profile |
| POST | `/api/v1/admin/stores/{id}/banner` | Upload store banner (multipart) |
| POST | `/api/v1/admin/stores/{id}/logo` | Upload store logo (multipart) |
| PATCH | `/api/v1/admin/stores/{id}/plan` | Assign seller plan |
| GET | `/api/v1/admin/stores/{id}/products` | Store's products (paginated) |
| GET | `/api/v1/admin/stores/{id}/orders` | Store's orders (paginated) |
| GET/POST/PATCH/DELETE | `/api/v1/admin/plans` | Seller subscription plans CRUD |
| GET/PATCH | `/api/v1/admin/platform-settings` | Platform-wide marketplace settings |
| GET | `/api/v1/admin/seller-payouts` | List payouts (`?status=`) |
| GET | `/api/v1/admin/seller-payouts/stats` | Payout stats |
| POST | `/api/v1/admin/seller-payouts/{id}/pay` | Mark payout as paid |
| GET | `/api/v1/admin/finance/stats` | Marketplace finance stats |
| GET | `/api/v1/admin/finance/chart` | Revenue chart (`?days=`) |
| GET | `/api/v1/admin/finance/stores` | Per-store finance breakdown (paginated) |

### Seller Self-Service Endpoints (multi-vendor store owner)
File: `apps/api/src/modules/stores/seller-orders.controller.ts` — guard `StoreOwnerGuard` (yêu cầu `req.store` gắn với user hiện tại).

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/seller/orders/stats` | Dashboard KPIs |
| GET | `/api/v1/seller/orders/counts` | Order counts by status |
| GET | `/api/v1/seller/orders/recent` | Last 5 orders |
| GET | `/api/v1/seller/orders` | Paginated order list (`?status=`) |
| GET | `/api/v1/seller/orders/{id}` | Order detail |
| PATCH | `/api/v1/seller/orders/{id}` | Update status/tracking/notes |
| POST | `/api/v1/seller/orders/{id}/ship` | Mark shipped + notify buyer |
| GET | `/api/v1/seller/payouts` | Payout history + available balance |
| POST | `/api/v1/seller/payouts/request` | Request a payout |
| GET | `/api/v1/seller/reviews` | Reviews for own store |
| POST | `/api/v1/seller/reviews/{id}/reply` | Reply to a review as seller |
| GET | `/api/v1/seller/score` | Own store performance score breakdown |

Xem thêm `/api/v1/seller/products/*` ở `04_product.spec.md` §2.
