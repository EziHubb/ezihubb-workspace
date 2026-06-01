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

| Model | Mô tả |
|---|---|
| User | Tài khoản người dùng |
| RefreshToken | JWT refresh tokens (httpOnly cookie) |
| Address | Địa chỉ giao hàng của user |
| WishlistItem | Sản phẩm yêu thích |
| Category | Danh mục (tree, self-reference) |
| Collection | Bộ sưu tập sản phẩm |
| CollectionProduct | M2M: Collection ↔ Product |
| Product | Sản phẩm |
| ProductVariant | Biến thể sản phẩm (SKU) |
| VariantOption | Tên tuỳ chọn biến thể (Color, Size) |
| VariantOptionValue | Giá trị tuỳ chọn (Red, M) |
| Cart | Giỏ hàng (user hoặc guest) |
| CartItem | Items trong giỏ hàng |
| Order | Đơn hàng |
| OrderItem | Items trong đơn hàng |
| Payment | Thanh toán (Stripe/PayPal) |
| Review | Đánh giá sản phẩm |
| PromoCode | Mã giảm giá |
| PromoUsage | Lịch sử dùng promo code |
| ShippingZone | Khu vực vận chuyển |
| ShippingMethod | Phương thức vận chuyển |

### Enums
```prisma
enum Role       { CUSTOMER ADMIN SUPER_ADMIN }
enum Provider   { EMAIL GOOGLE FACEBOOK }
enum OrderStatus { PENDING_PAYMENT PAYMENT_CONFIRMED PROCESSING SHIPPED DELIVERED CANCELLED PAYMENT_FAILED }
enum PaymentStatus { PENDING COMPLETED FAILED REFUNDED }
```

### Key Design Decisions
- Soft delete: User có `deletedAt` field (không xoá thật)
- Snapshot: Order lưu địa chỉ dưới dạng JSON (không FK) để tránh data drift
- Decimal cho tiền (không dùng Float)
- `@updatedAt` trên tất cả models có mutable state

## 2. MongoDB (Mongoose)

### Connection
- Module: `apps/api/src/mongodb/mongodb.module.ts`
- Env: `MONGODB_URI`
- SRV resolution: DoH (DNS-over-HTTPS) via `dns.google/resolve` (bypass UDP 53 blocking)
- Pattern: Resolve `mongodb+srv://` → direct `mongodb://` trước khi connect

### Collections

| Collection | Schema | Mô tả |
|---|---|---|
| `product_details` | IProductDetail | Chi tiết phong phú, customization config |
| `mega_menus` | IMegaMenu | Mega menu data (cached) |

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

### mega_menus Schema
```typescript
interface IMegaMenu {
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

File: `prisma/seed.ts`
- Runs: `pnpm prisma db seed` (reads from `.env`)
- Clears: all tables in order (CartItem, OrderItem, Cart, Order, Payment, Review, WishlistItem, CollectionProduct, ProductVariant, VariantOptionValue, VariantOption, Product, Collection, Category, Address, RefreshToken, User)
- Seeds: Users, Categories, Products, Variants, MongoDB product_details
- MongoDB seed helper: `prisma/seed-mongo.ts`
