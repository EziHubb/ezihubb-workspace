# Module 09 — Shipping & Delivery

## 1. Tổng quan

Tính phí vận chuyển, quản lý shipping methods, tích hợp tracking từ carrier.

---

## 2. User Stories

- **US-SHIP-001:** Là khách, tôi muốn thấy các lựa chọn vận chuyển và phí tương ứng trước khi thanh toán.
- **US-SHIP-002:** Là khách, tôi muốn xem estimated delivery date cho từng shipping method.
- **US-SHIP-003:** Là khách, tôi muốn nhận email có tracking number khi đơn hàng được ship.
- **US-SHIP-004:** Là khách, tôi muốn click vào link tracking để xem vị trí đơn hàng.
- **US-SHIP-005:** Là admin, tôi muốn cấu hình các shipping zones và rates trong admin panel.
- **US-SHIP-006:** Là admin, tôi muốn cấu hình free shipping cho đơn từ một mức nhất định.

---

## 3. API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| POST | `/shipping/calculate` | Tính phí ship | No |
| GET | `/shipping/methods` | Danh sách phương thức | No |
| GET | `/admin/shipping/zones` | Quản lý zones | Admin |
| POST | `/admin/shipping/zones` | Tạo zone | Admin |
| PATCH | `/admin/shipping/zones/:id` | Sửa zone | Admin |

---

## 4. Data Models

```prisma
model ShippingZone {
  id          String           @id @default(cuid())
  name        String           -- "United States", "Europe"
  countries   String[]         -- ["US"] hoặc ["GB", "DE", "FR"]
  methods     ShippingMethod[]
}

model ShippingMethod {
  id                String      @id @default(cuid())
  zoneId            String
  zone              ShippingZone @relation(fields: [zoneId], references: [id])
  name              String      -- "Standard (5-10 days)", "Express (2-3 days)"
  carrier           String?     -- "USPS", "FedEx", "UPS"
  price             Decimal     @db.Decimal(10, 2)
  freeShippingOver  Decimal?    @db.Decimal(10, 2)  -- free nếu order >= giá này
  minDays           Int
  maxDays           Int
  isActive          Boolean     @default(true)
}
```

---

## 5. Business Rules

- Processing time (POD) cộng thêm vào estimated delivery: `processingDays + shippingDays`.
- Free shipping threshold check áp dụng **sau khi trừ discount**.
- Nếu không có shipping zone cho country → hiện thông báo "We don't ship to this location".
- Tracking URL: tự compose từ carrier + tracking number (ví dụ USPS: `https://tools.usps.com/go/TrackConfirmAction?tLabels={trackingNumber}`).

---
---

# Module 10 — Review & Rating

## 1. Tổng quan

Khách hàng đánh giá sản phẩm sau khi nhận hàng. Chỉ khách đã mua mới được review.

---

## 2. User Stories

- **US-REV-001:** Là người dùng đã nhận hàng, tôi muốn đánh giá sản phẩm (1-5 sao) kèm nhận xét.
- **US-REV-002:** Là người dùng, tôi muốn upload ảnh thực tế sản phẩm vào review.
- **US-REV-003:** Là khách, tôi muốn xem tổng hợp đánh giá (rating trung bình, phân bố sao) trên trang sản phẩm.
- **US-REV-004:** Là khách, tôi muốn lọc đánh giá theo số sao.
- **US-REV-005:** Là admin, tôi muốn duyệt, ẩn, hoặc trả lời review.
- **US-REV-006:** Hệ thống tự động gửi email nhắc review 7 ngày sau khi đơn ở trạng thái DELIVERED.

---

## 3. API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| GET | `/products/:slug/reviews` | Danh sách review | No |
| GET | `/products/:slug/reviews/summary` | Tổng hợp rating | No |
| POST | `/reviews` | Tạo review | Yes |
| PATCH | `/reviews/:id` | Sửa review (của mình) | Yes |
| DELETE | `/reviews/:id` | Xóa review (của mình) | Yes |
| POST | `/admin/reviews/:id/approve` | Duyệt review | Admin |
| POST | `/admin/reviews/:id/hide` | Ẩn review | Admin |
| POST | `/admin/reviews/:id/reply` | Admin trả lời | Admin |

---

## 4. Data Models

```prisma
model Review {
  id          String        @id @default(cuid())
  userId      String
  user        User          @relation(fields: [userId], references: [id])
  productId   String
  product     Product       @relation(fields: [productId], references: [id])
  orderId     String        -- chỉ review nếu đã mua
  rating      Int           -- 1-5
  title       String?
  body        String
  imageUrls   String[]
  status      ReviewStatus  @default(PENDING)
  adminReply  String?
  repliedAt   DateTime?
  createdAt   DateTime      @default(now())

  @@unique([userId, productId, orderId])
}

enum ReviewStatus { PENDING APPROVED HIDDEN }
```

---

## 5. Business Rules

- Chỉ đánh giá được sản phẩm trong đơn hàng có trạng thái `DELIVERED` hoặc `COMPLETED`.
- Mỗi user chỉ review **một lần** mỗi sản phẩm mỗi đơn hàng.
- Review mặc định là `PENDING` — admin duyệt mới hiện ra (hoặc auto-approve sau 24h nếu không có nội dung nhạy cảm).
- Ảnh trong review tối đa **5 ảnh**, mỗi ảnh tối đa **5MB**.
- Rating summary cache trên Redis, invalidate khi có review mới.

---
---

# Module 11 — Promotion & Discount

## 1. Tổng quan

Quản lý coupon code, flash sale, free shipping promotion.

---

## 2. User Stories

- **US-PROMO-001:** Là khách, tôi muốn nhập coupon code trong giỏ hàng và thấy số tiền giảm ngay.
- **US-PROMO-002:** Là khách, tôi muốn thấy thông báo lỗi rõ ràng nếu coupon không hợp lệ.
- **US-PROMO-003:** Là admin, tôi muốn tạo coupon với nhiều loại: % giảm, giảm cố định, free shipping.
- **US-PROMO-004:** Là admin, tôi muốn giới hạn coupon theo: ngày hết hạn, số lần dùng tổng, số lần dùng/người.
- **US-PROMO-005:** Là admin, tôi muốn xem thống kê coupon: số lần dùng, tổng discount đã cấp.

---

## 3. API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| POST | `/promotions/validate` | Validate coupon | No |
| GET | `/admin/promotions` | Danh sách promotion | Admin |
| POST | `/admin/promotions` | Tạo promotion | Admin |
| PATCH | `/admin/promotions/:id` | Sửa promotion | Admin |
| DELETE | `/admin/promotions/:id` | Xóa/deactivate | Admin |
| GET | `/admin/promotions/:id/stats` | Thống kê coupon | Admin |

---

## 4. Data Models

```prisma
model Promotion {
  id              String         @id @default(cuid())
  code            String         @unique
  type            DiscountType
  value           Decimal        @db.Decimal(10, 2)  -- % hoặc $ hoặc không dùng (free ship)
  minOrderAmount  Decimal?       @db.Decimal(10, 2)
  maxUses         Int?           -- null = unlimited
  maxUsesPerUser  Int            @default(1)
  currentUses     Int            @default(0)
  isActive        Boolean        @default(true)
  startsAt        DateTime?
  expiresAt       DateTime?
  description     String?
  usages          PromotionUsage[]
  createdAt       DateTime       @default(now())
}

enum DiscountType { PERCENTAGE FIXED_AMOUNT FREE_SHIPPING }

model PromotionUsage {
  id          String    @id @default(cuid())
  promotionId String
  promotion   Promotion @relation(fields: [promotionId], references: [id])
  userId      String?
  orderId     String
  usedAt      DateTime  @default(now())
}
```

---

## 5. Business Rules

- Validate coupon: kiểm tra `isActive`, `startsAt ≤ now ≤ expiresAt`, `currentUses < maxUses`, `userUses < maxUsesPerUser`, `order subtotal ≥ minOrderAmount`.
- Chỉ một coupon per order.
- `PERCENTAGE` discount tối đa 100%.
- `currentUses` tăng nguyên tử (atomic increment) khi đơn `CONFIRMED` để tránh race condition.

---
---

# Module 12 — Notification

## 1. Tổng quan

Gửi thông báo qua email (transactional) và in-app notification. Tất cả email đẩy qua Bull Queue để không block request.

---

## 2. User Stories

- **US-NOTIF-001:** Là người dùng, tôi muốn nhận email xác nhận đơn hàng ngay sau khi đặt thành công.
- **US-NOTIF-002:** Là người dùng, tôi muốn nhận email khi đơn được ship (kèm tracking number).
- **US-NOTIF-003:** Là người dùng, tôi muốn nhận email nhắc đánh giá sau 7 ngày nhận hàng.
- **US-NOTIF-004:** Là người dùng, tôi muốn nhận email khi đặt lại mật khẩu thành công.
- **US-NOTIF-005:** Là admin, tôi muốn gửi email marketing theo nhóm khách hàng (newsletter).

---

## 3. Email Templates

| Trigger | Template |
|---------|----------|
| Đăng ký | `welcome.hbs` |
| Xác thực email | `email-verify.hbs` |
| Quên mật khẩu | `reset-password.hbs` |
| Đặt hàng thành công | `order-confirmation.hbs` |
| Đơn hàng shipped | `order-shipped.hbs` |
| Đơn hàng delivered | `order-delivered.hbs` |
| Nhắc review | `review-reminder.hbs` |
| Hoàn tiền | `refund-notification.hbs` |

---

## 4. Queue Jobs (Bull)

```typescript
// Email Queue Jobs
interface SendEmailJob {
  to: string
  template: string
  subject: string
  data: Record<string, any>
}

// Scheduled Jobs
- review-reminder: chạy hàng ngày, tìm đơn DELIVERED 7 ngày trước chưa có review
- order-auto-complete: chạy hàng ngày, chuyển DELIVERED > 7 ngày → COMPLETED
- cleanup-temp-images: chạy hàng ngày, xóa ảnh upload chưa dùng > 24h
- cleanup-expired-carts: chạy hàng tuần, xóa guest cart expired
```

---
---

# Module 13 — Admin Dashboard

## 1. Tổng quan

Giao diện quản trị toàn hệ thống cho admin. Xây dựng trên Next.js route group `/app/(admin)`.

---

## 2. User Stories — Admin

- **US-ADMIN-001:** Là admin, tôi muốn xem dashboard tổng quan: doanh thu hôm nay, đơn mới, đơn cần xử lý.
- **US-ADMIN-002:** Là admin, tôi muốn xem biểu đồ doanh thu theo ngày/tuần/tháng.
- **US-ADMIN-003:** Là admin, tôi muốn quản lý toàn bộ sản phẩm (CRUD + publish/unpublish).
- **US-ADMIN-004:** Là admin, tôi muốn quản lý đơn hàng (filter, search, update status, add tracking).
- **US-ADMIN-005:** Là admin, tôi muốn quản lý khách hàng (xem thông tin, lịch sử đơn hàng).
- **US-ADMIN-006:** Là admin, tôi muốn quản lý promotion codes.
- **US-ADMIN-007:** Là admin, tôi muốn xem và duyệt reviews.
- **US-ADMIN-008:** Là admin, tôi muốn quản lý categories và collections.
- **US-ADMIN-009:** Là admin, tôi muốn xem log hoạt động của admin khác.

---

## 3. Admin Dashboard Sections

```
/admin
├── /dashboard          — Overview, KPIs, charts
├── /orders             — Order list, detail, status update
├── /products           — Product list, create, edit
│   └── /products/new
│   └── /products/:id/edit
├── /catalog
│   ├── /categories
│   └── /collections
├── /customers          — Customer list, detail
├── /promotions         — Coupon management
├── /reviews            — Review moderation
├── /shipping           — Shipping zones & rates
├── /payments           — Transaction history, refunds
└── /settings           — Store settings, email templates
```

---

## 4. KPI Dashboard

| Metric | Mô tả |
|--------|--------|
| Today's Revenue | Tổng doanh thu hôm nay |
| Orders Today | Số đơn hàng hôm nay |
| Pending Orders | Đơn đang chờ xử lý |
| In Production | Đơn đang sản xuất |
| Avg Order Value | Giá trị đơn trung bình (30 ngày) |
| Conversion Rate | Tỷ lệ cart → order (30 ngày) |
| Top Products | Top 10 sản phẩm bán chạy |
| Recent Reviews | Review mới nhất cần duyệt |

---
---

# Module 14 — Search & Filter

## 1. Tổng quan

Tìm kiếm sản phẩm full-text + filter nâng cao. Sử dụng PostgreSQL full-text search cho MVP; có thể mở rộng sang Elasticsearch sau.

---

## 2. User Stories

- **US-SEARCH-001:** Là khách, tôi muốn tìm kiếm sản phẩm bằng từ khóa từ bất kỳ trang nào.
- **US-SEARCH-002:** Là khách, tôi muốn xem kết quả autocomplete khi gõ vào thanh tìm kiếm.
- **US-SEARCH-003:** Là khách, tôi muốn lọc kết quả theo: category, price range, rating, collection.
- **US-SEARCH-004:** Là khách, tôi muốn sắp xếp kết quả: mới nhất, giá tăng/giảm, bán chạy nhất.
- **US-SEARCH-005:** Là khách, tôi muốn xem "No results" với gợi ý từ khóa liên quan nếu không tìm thấy.

---

## 3. API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| GET | `/search?q=&category=&minPrice=&maxPrice=&rating=&sort=&page=` | Tìm kiếm | No |
| GET | `/search/autocomplete?q=` | Autocomplete | No |
| GET | `/search/trending` | Từ khóa trending | No |

---

## 4. Filter Parameters

```typescript
interface SearchQuery {
  q?: string           // từ khóa
  category?: string    // category slug
  collection?: string  // collection slug
  tags?: string[]      // ["pet-lovers", "couples"]
  minPrice?: number
  maxPrice?: number
  minRating?: number   // 1-5
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'bestseller' | 'rating'
  page?: number        // default: 1
  limit?: number       // default: 24, max: 48
}
```

---

## 5. Business Rules

- Autocomplete debounce **300ms** ở client, trả về tối đa **8 gợi ý**.
- Search chỉ trả về sản phẩm `isActive = true`.
- Search log (từ khóa + số kết quả) lưu để phân tích xu hướng.
- Trending keywords: top 10 từ khóa được tìm nhiều nhất trong 7 ngày.
- PostgreSQL full-text search dùng `tsvector` trên `name + description + tags`.
