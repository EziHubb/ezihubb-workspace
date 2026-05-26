# Module 16 — API Technical Conventions

## 1. Response Envelope

Mọi response từ API đều bọc trong cấu trúc chuẩn sau:

### Success (2xx)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-06-01T10:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

### Success — Paginated List
```json
{
  "success": true,
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 24,
    "total": 120,
    "totalPages": 5,
    "hasNext": true,
    "hasPrev": false
  },
  "meta": {
    "timestamp": "2024-06-01T10:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

### Error (4xx / 5xx)
```json
{
  "success": false,
  "error": {
    "code": "ERR_PRODUCT_NOT_FOUND",
    "message": "Product with slug 'custom-mug-abc' not found.",
    "details": [ ]
  },
  "meta": {
    "timestamp": "2024-06-01T10:00:00.000Z",
    "requestId": "req_abc123"
  }
}
```

### Validation Error (400)
```json
{
  "success": false,
  "error": {
    "code": "ERR_VALIDATION",
    "message": "Validation failed.",
    "details": [
      { "field": "email",    "message": "Must be a valid email address." },
      { "field": "password", "message": "Must be at least 8 characters." }
    ]
  }
}
```

---

## 2. Pagination Convention

Dùng **offset-based pagination** (không dùng cursor — đơn giản hơn cho admin filter/search).

### Query params chuẩn
```
GET /products?page=1&limit=24&sort=newest&order=desc
```

| Param | Default | Max | Mô tả |
|-------|---------|-----|-------|
| `page` | `1` | — | Trang hiện tại |
| `limit` | `24` | `48` | Số item mỗi trang |
| `sort` | `createdAt` | — | Field để sort |
| `order` | `desc` | — | `asc` hoặc `desc` |

---

## 3. Error Codes

### Auth Errors
| Code | HTTP | Mô tả |
|------|------|-------|
| `ERR_UNAUTHORIZED` | 401 | Chưa đăng nhập hoặc token hết hạn |
| `ERR_FORBIDDEN` | 403 | Không đủ quyền |
| `ERR_TOKEN_EXPIRED` | 401 | Access token hết hạn |
| `ERR_TOKEN_INVALID` | 401 | Token không hợp lệ |
| `ERR_REFRESH_TOKEN_INVALID` | 401 | Refresh token không hợp lệ |
| `ERR_EMAIL_NOT_VERIFIED` | 403 | Email chưa xác thực |
| `ERR_ACCOUNT_LOCKED` | 423 | Tài khoản bị khóa do đăng nhập sai nhiều lần |
| `ERR_CREDENTIALS_INVALID` | 401 | Sai email hoặc mật khẩu |
| `ERR_EMAIL_ALREADY_EXISTS` | 409 | Email đã được đăng ký |

### Resource Errors
| Code | HTTP | Mô tả |
|------|------|-------|
| `ERR_NOT_FOUND` | 404 | Resource không tồn tại (generic) |
| `ERR_PRODUCT_NOT_FOUND` | 404 | Sản phẩm không tồn tại |
| `ERR_PRODUCT_UNAVAILABLE` | 410 | Sản phẩm không còn active |
| `ERR_ORDER_NOT_FOUND` | 404 | Đơn hàng không tồn tại |
| `ERR_CART_NOT_FOUND` | 404 | Giỏ hàng không tồn tại |
| `ERR_USER_NOT_FOUND` | 404 | Người dùng không tồn tại |

### Order / Checkout Errors
| Code | HTTP | Mô tả |
|------|------|-------|
| `ERR_CART_EMPTY` | 400 | Giỏ hàng trống |
| `ERR_ORDER_CANNOT_CANCEL` | 400 | Quá 2 giờ, không thể hủy |
| `ERR_ORDER_WRONG_STATUS` | 400 | Trạng thái không hợp lệ cho thao tác này |
| `ERR_CHECKOUT_PRICE_CHANGED` | 400 | Giá sản phẩm đã thay đổi kể từ lúc thêm vào giỏ |
| `ERR_SHIPPING_NOT_AVAILABLE` | 400 | Không giao hàng đến địa chỉ này |

### Payment Errors
| Code | HTTP | Mô tả |
|------|------|-------|
| `ERR_PAYMENT_FAILED` | 402 | Thanh toán thất bại |
| `ERR_PAYMENT_ALREADY_PAID` | 409 | Đơn hàng đã được thanh toán |
| `ERR_GIFT_CARD_NOT_FOUND` | 404 | Gift card không tồn tại |
| `ERR_GIFT_CARD_EXPIRED` | 400 | Gift card đã hết hạn |
| `ERR_GIFT_CARD_INSUFFICIENT` | 400 | Số dư gift card không đủ |
| `ERR_REFUND_EXCEEDS_AMOUNT` | 400 | Hoàn tiền vượt quá số tiền đã thanh toán |
| `ERR_REFUND_WINDOW_EXPIRED` | 400 | Quá 60 ngày, không thể hoàn tiền |

### Promotion Errors
| Code | HTTP | Mô tả |
|------|------|-------|
| `ERR_COUPON_NOT_FOUND` | 404 | Mã coupon không tồn tại |
| `ERR_COUPON_EXPIRED` | 400 | Mã coupon đã hết hạn |
| `ERR_COUPON_NOT_STARTED` | 400 | Mã coupon chưa có hiệu lực |
| `ERR_COUPON_MAX_USES` | 400 | Mã coupon đã hết lượt dùng |
| `ERR_COUPON_MAX_USES_PER_USER` | 400 | Bạn đã dùng mã này rồi |
| `ERR_COUPON_MIN_ORDER` | 400 | Đơn hàng chưa đạt giá trị tối thiểu |

### Customization / Upload Errors
| Code | HTTP | Mô tả |
|------|------|-------|
| `ERR_FILE_TOO_LARGE` | 400 | File vượt quá 10MB |
| `ERR_FILE_TYPE_INVALID` | 400 | Định dạng file không hỗ trợ |
| `ERR_UPLOAD_FAILED` | 500 | Upload thất bại |
| `ERR_BG_REMOVAL_FAILED` | 500 | Xóa background thất bại |
| `ERR_PREVIEW_GENERATION_FAILED` | 500 | Tạo preview thất bại |
| `ERR_TEMPLATE_NOT_FOUND` | 404 | Template customization không tồn tại |

### Review Errors
| Code | HTTP | Mô tả |
|------|------|-------|
| `ERR_REVIEW_NOT_PURCHASED` | 403 | Chưa mua sản phẩm này |
| `ERR_REVIEW_ALREADY_EXISTS` | 409 | Đã đánh giá sản phẩm này trong đơn hàng này |

### Generic Errors
| Code | HTTP | Mô tả |
|------|------|-------|
| `ERR_VALIDATION` | 400 | Validation thất bại |
| `ERR_INTERNAL` | 500 | Lỗi server |
| `ERR_RATE_LIMIT` | 429 | Quá nhiều request |
| `ERR_CONFLICT` | 409 | Xung đột dữ liệu (generic) |

---

## 4. Rate Limiting

| Endpoint / Group | Limit | Window |
|-----------------|-------|--------|
| `POST /auth/login` | 5 requests | 15 phút / IP |
| `POST /auth/register` | 3 requests | 1 giờ / IP |
| `POST /auth/forgot-password` | 3 requests | 1 giờ / IP |
| `POST /customization/upload-image` | 20 requests | 1 giờ / IP |
| `POST /customization/remove-background` | 10 requests | 1 giờ / IP |
| `POST /customization/generate-preview` | 20 requests | 1 giờ / IP |
| `GET /search` | 60 requests | 1 phút / IP |
| `GET /search/autocomplete` | 120 requests | 1 phút / IP |
| Tất cả public API | 300 requests | 1 phút / IP |
| Tất cả authenticated API | 600 requests | 1 phút / user |
| Admin API | 1200 requests | 1 phút / user |

Khi bị rate limit, trả về:
```json
{
  "success": false,
  "error": {
    "code": "ERR_RATE_LIMIT",
    "message": "Too many requests. Please try again later.",
    "details": [{ "retryAfter": 47 }]
  }
}
```
Header bổ sung: `Retry-After: 47`, `X-RateLimit-Limit: 5`, `X-RateLimit-Remaining: 0`

---

## 5. Authentication Header

```
Authorization: Bearer <accessToken>
```

Guest sessions dùng cookie:
```
Cookie: session_id=<sessionId>; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000
```

Refresh token dùng httpOnly cookie (không expose qua JS):
```
Cookie: refresh_token=<token>; Path=/auth/refresh; HttpOnly; Secure; SameSite=Strict
```

---

## 6. Request ID & Logging

- Mỗi request được gán `requestId` = `req_<cuid>` bởi middleware.
- `requestId` trả về trong mọi response (`meta.requestId`) và ghi vào log.
- Log format: JSON structured logging (Winston).
- Log levels: `error`, `warn`, `info`, `debug`.
- Sensitive fields bị mask trong log: `password`, `passwordHash`, `cardNumber`, `stripeSecretKey`.

---

## 7. Versioning

- API version prefix: `/api/v1/...`
- Hiện tại chỉ có `v1`. Khi cần breaking change → tạo `/api/v2/` song song.

---

## 8. CORS

```typescript
// Allowed origins
const allowedOrigins = [
  'https://mapleloomhandmade.com',
  'https://www.mapleloomhandmade.com',
  'http://localhost:3000', // dev
]

// Allowed methods
['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']

// Allowed headers
['Content-Type', 'Authorization', 'X-Request-ID']

// Credentials: true (để gửi cookie)
```

---

## 9. Audit Log (Admin Actions)

Mọi thao tác của admin ghi vào bảng `AuditLog`:

```prisma
model AuditLog {
  id         String   @id @default(cuid())
  userId     String
  action     String   -- "ORDER_STATUS_UPDATED", "PRODUCT_DELETED", ...
  entityType String   -- "Order", "Product", "User", ...
  entityId   String
  before     Json?    -- trạng thái trước
  after      Json?    -- trạng thái sau
  ip         String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

Audit actions:
```
AUTH:          LOGIN, LOGOUT, PASSWORD_CHANGED, PASSWORD_RESET
PRODUCT:       CREATED, UPDATED, DELETED, PUBLISHED, UNPUBLISHED, DUPLICATED
ORDER:         STATUS_UPDATED, TRACKING_ADDED, CANCELLED, REFUNDED
PROMOTION:     CREATED, UPDATED, DEACTIVATED
REVIEW:        APPROVED, HIDDEN, REPLIED
USER:          ROLE_CHANGED, DEACTIVATED
SHIPPING:      ZONE_CREATED, ZONE_UPDATED, METHOD_UPDATED
```
