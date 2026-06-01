# Modules 09–14 — Supporting Modules

## Module 09 — Reviews & Ratings

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/products/{slug}/reviews` | Danh sách reviews | No |
| POST | `/api/v1/products/{slug}/reviews` | Tạo review | Bearer |
| PATCH | `/api/v1/reviews/{id}` | Cập nhật review | Bearer (owner) |
| DELETE | `/api/v1/reviews/{id}` | Xoá review | Bearer (owner/admin) |
| GET | `/api/v1/admin/reviews` | Admin: all reviews | ADMIN |
| PATCH | `/api/v1/admin/reviews/{id}/approve` | Admin: approve review | ADMIN |

### Prisma Model
```prisma
model Review {
  id         String   @id @default(cuid())
  productId  String
  userId     String
  orderId    String?
  rating     Int      // 1-5
  title      String?
  body       String?
  imageUrls  String[]
  isApproved Boolean  @default(false)
  isVerified Boolean  @default(false)  // verified purchase
  createdAt  DateTime @default(now())
  @@unique([productId, userId])
}
```

### Business Rules
- User chỉ review 1 lần/product
- `isVerified: true` nếu có orderId (mua hàng thực tế)
- Review cần được duyệt (`isApproved`) trước khi hiển thị
- Rating aggregate cập nhật trên `Product` (avg, count) khi review approved

---

## Module 10 — Search

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/search` | Full-text search products | No |
| GET | `/api/v1/search/suggestions` | Search autocomplete | No |

### Query Parameters
| Param | Type | Mô tả |
|---|---|---|
| q | string | Search query (required) |
| page | number | Trang (default: 1) |
| limit | number | Results/trang (default: 24) |
| category | string | Filter by category slug |
| minPrice | number | Min price filter |
| maxPrice | number | Max price filter |
| sort | string | `relevance`, `price_asc`, `price_desc`, `newest` |

### Implementation
- PostgreSQL full-text search với `tsvector` + `tsquery`
- Index trên `Product.name`, `Product.description`
- Fallback: ILIKE search khi FTS không có kết quả

### Frontend
- Search bar trong header: `apps/client/src/components/layout/SearchBar.tsx`
- Results page: `/[locale]/search?q=...`
- Suggestions: debounce 300ms, min 2 chars

---

## Module 11 — Promotions & Promo Codes

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/promotions/apply` | Apply promo code to cart | Optional |
| DELETE | `/api/v1/promotions/remove` | Remove promo code | Optional |
| GET | `/api/v1/admin/promotions` | Admin: all promo codes | ADMIN |
| POST | `/api/v1/admin/promotions` | Admin: tạo promo code | ADMIN |
| PATCH | `/api/v1/admin/promotions/{id}` | Admin: cập nhật promo | ADMIN |

### Prisma Model
```prisma
model PromoCode {
  id              String    @id @default(cuid())
  code            String    @unique
  type            String    // "percentage" | "fixed" | "free_shipping"
  value           Decimal
  minOrderAmount  Decimal?
  maxUsage        Int?
  currentUsage    Int       @default(0)
  startDate       DateTime?
  endDate         DateTime?
  isActive        Boolean   @default(true)
  applicableIds   String[]  // productIds hoặc categoryIds (rỗng = all)
}
```

### Business Rules
- Code case-insensitive
- Validate: active + date range + usage limit + min order
- Discount capped at order subtotal
- Promo code theo product: chỉ discount items trong `applicableIds`

---

## Module 12 — Shipping

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/shipping/rates` | Lấy shipping rates | No |
| POST | `/api/v1/shipping/calculate` | Tính phí ship | No |

### Query Parameters (GET /shipping/rates)
- `country`: country code (required)
- `state`: state/province
- `weight`: total weight in grams (optional)

### Prisma Models
```prisma
model ShippingZone {
  id          String          @id @default(cuid())
  name        String
  countries   String[]
  methods     ShippingMethod[]
}

model ShippingMethod {
  id              String       @id @default(cuid())
  zoneId          String
  name            String
  carrier         String?
  estimatedDays   String       // e.g. "3-5"
  basePrice       Decimal
  perItemPrice    Decimal      @default(0)
  freeShippingMin Decimal?
  isActive        Boolean      @default(true)
}
```

---

## Module 13 — Notifications & Email

### Endpoints
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/notifications/product-ready` | Đăng ký notify khi sp sẵn sàng | No |
| GET | `/api/v1/admin/notifications` | Admin: notification logs | ADMIN |

### Email Service
- Dev: SMTP (MailHog localhost:1025)
- Prod: SendGrid (SENDGRID_API_KEY)
- Templates: HTML trong `apps/api/src/notifications/templates/`

### Email Types
- Welcome email (sau register)
- Email verification
- Password reset
- Order confirmation
- Order shipped (với tracking number)
- Order delivered
- Order cancelled / refunded
- Product ready notification (Flow B)

### Queue
- Email jobs qua BullMQ (queue: `email-queue`)
- Dev fallback: DISABLE_QUEUE=true → DevBullModule (no-op)
- Job retry: 3 lần với exponential backoff

---

## Module 14 — Admin

### Endpoints (ADMIN role required)
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/admin/dashboard` | Dashboard metrics |
| GET | `/api/v1/admin/products` | Manage products |
| POST | `/api/v1/admin/products` | Tạo sản phẩm |
| PATCH | `/api/v1/admin/products/{id}` | Cập nhật sản phẩm |
| DELETE | `/api/v1/admin/products/{id}` | Xoá sản phẩm |
| GET | `/api/v1/admin/orders` | All orders |
| PATCH | `/api/v1/admin/orders/{id}/status` | Cập nhật order status |
| GET | `/api/v1/admin/users` | All users |
| PATCH | `/api/v1/admin/users/{id}` | Cập nhật user |

### Admin App
- Separate Next.js app: `apps/admin`
- Port: 3001
- Nx project name: `admin`
- Auth: reuses same JWT system, checks `role === ADMIN || role === SUPER_ADMIN`

### Guard
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'SUPER_ADMIN')
```
