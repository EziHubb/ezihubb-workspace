# Module 15 — Database & Data Structure

## 1. PostgreSQL (Prisma)

### Connection
- Driver adapter pattern (Prisma 7): NO `url` in datasource block
- Requires `@prisma/adapter-pg` + `pg` package
- Config: `prisma/prisma.config.ts` exports `PrismaClient` instance using PgPrismaAdapter
- Env: `DATABASE_URL`

### Schema File
`prisma/schema.prisma`

### Complete Model List

**Lưu ý:** Schema hiện có **100+ models** (đã lớn hơn nhiều so với con số 21 ban đầu — mỗi feature module mới trong `apps/api/src/modules/` thường thêm 1-10 models riêng: Store/SellerPlan/SellerPayout, AffiliateAccount/AffiliateCommission/AffiliatePayout, LoyaltyAccount/LoyaltyTransaction, ReferralTier/ReferralCommission, ModerationLog/ModerationRule, GiftChain/GiftChainLink, GiftPool/GiftContribution, FlashDeal, BlindMatchRequest, Campaign, BuyerCoinBalance, DesignAsset/DesignLicense, CreatorDNAAnalysis, v.v.). Bảng dưới đây liệt kê các models cốt lõi (transactional core); xem `docs/gap-analysis.md` §1.4 để có danh sách models đầy đủ hơn (không exhaustive — cả hai đều có thể lệch so với schema.prisma tại một thời điểm, luôn grep `prisma/schema.prisma` để chắc chắn).

| Model | Mô tả |
|---|---|
| User | Tài khoản người dùng |
| RefreshToken | JWT refresh tokens (httpOnly cookie) |
| FcmToken | Token FCM cho push notification |
| Address | Địa chỉ giao hàng của user |
| WishlistItem | Sản phẩm yêu thích |
| Category | Danh mục (tree, self-reference) |
| Collection | Bộ sưu tập sản phẩm |
| CollectionProduct | M2M: Collection ↔ Product |
| Product | Sản phẩm |
| ProductVariant | Biến thể sản phẩm (SKU) |
| VariationGroup | Nhóm tuỳ chọn biến thể (Color, Size) |
| VariationOption | Giá trị tuỳ chọn (Red, M) |
| Cart | Giỏ hàng (user hoặc guest) |
| CartItem | Items trong giỏ hàng |
| Order | Đơn hàng |
| OrderItem | Items trong đơn hàng |
| Payment | Thanh toán (Stripe/PayPal) |
| Review | Đánh giá sản phẩm |
| Promotion | Mã giảm giá / coupon |
| PromotionUsage | Lịch sử dùng promotion |
| GiftCard | Thẻ quà tặng |
| ShippingZone | Khu vực vận chuyển |
| ShippingMethod | Phương thức vận chuyển |
| Store | Shop của seller (multi-vendor) |

### Enums
```prisma
enum Role       { CUSTOMER ADMIN SUPER_ADMIN }
enum Provider   { EMAIL GOOGLE FACEBOOK }
enum OrderStatus { PENDING_PAYMENT CONFIRMED IN_PRODUCTION SHIPPED DELIVERED COMPLETED CANCELLED REFUND_REQUESTED REFUNDED DISPUTED }
enum PaymentStatus { PENDING PAID FAILED REFUNDED PARTIALLY_REFUNDED }
```

### Key Design Decisions
- Soft delete: User có `deletedAt` field (không xoá thật)
- Snapshot: Order lưu địa chỉ dưới dạng JSON (không FK) để tránh data drift
- Decimal cho tiền (không dùng Float)
- `@updatedAt` trên tất cả models có mutable state

## 2. MongoDB (Mongoose)

### Connection
- Module: `apps/api/src/modules/database/mongodb.module.ts`
- Schemas: `apps/api/src/modules/catalog/schemas/product-detail.schema.ts`, `category-menu.schema.ts`
- Env: `MONGODB_URI`
- SRV resolution: DoH (DNS-over-HTTPS) via `dns.google/resolve` (bypass UDP 53 blocking) — implemented both in `main.ts` and `mongodb.module.ts`
- Pattern: Resolve `mongodb+srv://` → direct `mongodb://` trước khi connect

### Collections

| Collection | Schema Class | Mô tả |
|---|---|---|
| `product_details` | ProductDetail | Chi tiết phong phú, customization config |
| `category_menus` | CategoryMenu | Mega menu data (cached) |

### product_details Schema
```typescript
interface IProductDetail {
  _id: ObjectId;
  productId: string;       // FK → PostgreSQL Product.id
  attributes?: { name: string; value: string }[];
  customization?: {
    templateId: string;
    version: number;
    bundleCount?: number;
    fields: CustomizationField[];
    previewLayers: PreviewLayer[];
  };
  sizeGuide?: { type: string; html: string };
  shippingInfo?: { processingDays: number; carrier: string };
  createdAt: Date;
  updatedAt: Date;
}
```

### category_menus Schema
```typescript
interface ICategoryMenu {
  _id: ObjectId;
  categories: {
    id: string; name: string; slug: string; imageUrl?: string;
    subcategories?: { id: string; name: string; slug: string }[];
    featured?: { productSlug: string; imageUrl: string; label: string }[];
  }[];
  updatedAt: Date;
}
```

## 3. Redis

### Purpose
- Session/Cart cache: `cart:session:<sessionId>` (TTL: 7 days)
- Auth: blacklisted tokens, rate limiting counters
- Mega menu cache: `mega-menu:v1` (TTL: 1 hour)
- Queue: BullMQ job queue backing store

### Dev Fallback
- `DISABLE_QUEUE=true` → DevBullModule (no-op queues)
- RedisService has `available` flag — silently returns fallbacks when not connected
- `uncaughtException` handler in main.ts catches Redis ECONNREFUSED errors

### Connection
- Env: `REDIS_URL=redis://localhost:6379`
- Module: `apps/api/src/common/services/redis.service.ts`

## 4. Data Flow

```
Client (Next.js)
  ↓ apiClient (auto-unwraps envelope)
NestJS API (port 3002)
  ├── PostgreSQL via PrismaService (transactional data)
  ├── MongoDB via MongooseModule (flexible/detail data)
  └── Redis via RedisService (cache + queues)
```

## 5. Seed

`prisma/seed.ts` is a thin orchestrator (delegates to `seeds/pg/` and `seeds/mongo/`):
- Runs: `pnpm db:seed` (= `prisma db seed --schema=prisma/schema.prisma`, reads from `.env`)
- `prisma/seeds/pg/index.ts` — runs 21 numbered PostgreSQL seed files in dependency order (users → categories → collections → processing/shipping profiles → shop sections → store → products → collection links → promotions → shipping zones → attribute values → affiliates → addresses → orders → conversations → reviews → gift cards → loyalty → wishlists/Q&A)
- `prisma/seeds/mongo/index.ts` — seeds `category_menus` (derived from PG category tree) and `product_details`; connects with a DNS override (`dns.setServers(['8.8.8.8','1.1.1.1'])`) and retry logic
- `prisma/seeds/shared/` — `prisma-client.ts` (shared PrismaClient/pool instance), `mongo-schemas.ts`
- Standalone runs: `pnpm db:seed:pg`, `pnpm db:seed:mongo`, `pnpm db:fresh` (drop → migrate → seed)
