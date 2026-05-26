# Module 07 — Order Management

## 1. Tổng quan

Quản lý toàn bộ vòng đời đơn hàng từ khi tạo đến khi giao hàng, bao gồm cả luồng xử lý POD (sản xuất in ấn theo đơn).

---

## 2. User Stories

### 2.1 Đặt hàng
- **US-ORD-001:** Là khách, tôi muốn checkout với tư cách guest (không cần tạo tài khoản).
- **US-ORD-002:** Là người dùng, tôi muốn checkout nhanh với địa chỉ đã lưu.
- **US-ORD-003:** Là khách, tôi muốn nhập địa chỉ giao hàng và xem phí ship trước khi thanh toán.
- **US-ORD-004:** Là khách, tôi muốn xem order confirmation với chi tiết đầy đủ sau khi đặt thành công.
- **US-ORD-005:** Là khách, tôi nhận email xác nhận đơn hàng ngay sau khi đặt.

### 2.2 Theo dõi đơn hàng
- **US-ORD-006:** Là người dùng, tôi muốn xem danh sách đơn hàng theo thứ tự thời gian.
- **US-ORD-007:** Là người dùng, tôi muốn xem chi tiết từng đơn hàng, bao gồm ảnh preview customization.
- **US-ORD-008:** Là người dùng, tôi muốn track trạng thái đơn hàng và nhận thông báo khi có cập nhật.
- **US-ORD-009:** Là người dùng, tôi muốn xem tracking number và link theo dõi vận chuyển.

### 2.3 Hủy / Chỉnh sửa
- **US-ORD-010:** Là người dùng, tôi muốn hủy đơn hàng trong vòng 2 giờ sau khi đặt.
- **US-ORD-011:** Là người dùng, tôi muốn yêu cầu chỉnh sửa customization trong vòng 2 giờ.

### 2.4 Admin
- **US-ORD-012:** Là admin, tôi muốn xem tất cả đơn hàng với filter theo trạng thái, ngày.
- **US-ORD-013:** Là admin, tôi muốn cập nhật trạng thái đơn và nhập tracking number.
- **US-ORD-014:** Là admin, tôi muốn xem ảnh customization của từng item để sản xuất.
- **US-ORD-015:** Là admin, tôi muốn export danh sách đơn hàng cần xử lý ra CSV.

---

## 3. Order Status Flow

```
PENDING_PAYMENT
    │ (payment confirmed)
    ▼
CONFIRMED ──────────────────────────── (cancel trong 2h) ──► CANCELLED
    │
    │ (bắt đầu sản xuất)
    ▼
IN_PRODUCTION
    │ (sản xuất xong, giao cho đơn vị ship)
    ▼
SHIPPED
    │ (giao thành công)
    ▼
DELIVERED
    │ (7 ngày sau delivered, không dispute)
    ▼
COMPLETED
```

Nhánh đặc biệt:
- `REFUND_REQUESTED` → `REFUNDED`
- `DISPUTED` → `RESOLVED` hoặc `REFUNDED`

---

## 4. API Endpoints

| Method | Endpoint | Mô tả | Auth |
|--------|----------|--------|------|
| POST | `/orders` | Tạo đơn hàng (checkout) | No |
| GET | `/orders/:orderNumber` | Chi tiết đơn (public, dùng orderNumber + email) | No |
| GET | `/orders/me` | Danh sách đơn của tôi | Yes |
| GET | `/orders/me/:orderNumber` | Chi tiết đơn của tôi | Yes |
| POST | `/orders/:orderNumber/cancel` | Hủy đơn (trong 2h) | Yes/Guest |
| GET | `/admin/orders` | Danh sách đơn (admin) | Admin |
| GET | `/admin/orders/:id` | Chi tiết đơn (admin) | Admin |
| PATCH | `/admin/orders/:id/status` | Cập nhật trạng thái | Admin |
| PATCH | `/admin/orders/:id/tracking` | Nhập tracking number | Admin |
| GET | `/admin/orders/export` | Export CSV | Admin |

---

## 5. Data Models

```prisma
model Order {
  id              String      @id @default(cuid())
  orderNumber     String      @unique  -- "MLH-2024-00001"
  userId          String?
  user            User?       @relation(fields: [userId], references: [id])
  guestEmail      String?
  status          OrderStatus @default(PENDING_PAYMENT)
  
  -- Địa chỉ giao hàng (snapshot, không tham chiếu Address)
  shippingName    String
  shippingPhone   String
  shippingAddress String
  shippingCity    String
  shippingState   String?
  shippingZip     String
  shippingCountry String
  
  shippingMethod  String
  shippingCost    Decimal     @db.Decimal(10, 2)
  subtotal        Decimal     @db.Decimal(10, 2)
  discountAmount  Decimal     @default(0) @db.Decimal(10, 2)
  total           Decimal     @db.Decimal(10, 2)
  couponCode      String?
  
  -- Tracking
  trackingNumber  String?
  trackingUrl     String?
  carrier         String?
  
  note            String?
  cancelReason    String?
  cancelledAt     DateTime?
  
  items           OrderItem[]
  payment         Payment?
  statusHistory   OrderStatusHistory[]
  
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  confirmedAt     DateTime?
  shippedAt       DateTime?
  deliveredAt     DateTime?
}

enum OrderStatus {
  PENDING_PAYMENT
  CONFIRMED
  IN_PRODUCTION
  SHIPPED
  DELIVERED
  COMPLETED
  CANCELLED
  REFUND_REQUESTED
  REFUNDED
  DISPUTED
}

model OrderItem {
  id                String   @id @default(cuid())
  orderId           String
  order             Order    @relation(fields: [orderId], references: [id])
  productId         String
  product           Product  @relation(fields: [productId], references: [id])
  variantId         String?
  variant           ProductVariant? @relation(fields: [variantId], references: [id])
  productName       String   -- snapshot
  variantName       String?  -- snapshot
  quantity          Int
  unitPrice         Decimal  @db.Decimal(10, 2)
  customizationData Json?
  previewUrl        String?
}

model OrderStatusHistory {
  id        String      @id @default(cuid())
  orderId   String
  order     Order       @relation(fields: [orderId], references: [id])
  status    OrderStatus
  note      String?
  createdBy String?     -- userId của admin, null nếu system
  createdAt DateTime    @default(now())
}
```

---

## 6. Luồng Checkout

```
1. Client POST /orders với:
   { cartId hoặc items[], shippingAddress, shippingMethodId, couponCode? }

2. Server:
   ├── Validate cart items (product còn active không)
   ├── Validate coupon (còn hạn, đúng điều kiện)
   ├── Tính toán: subtotal, shipping, discount, total
   ├── Tạo Order (status: PENDING_PAYMENT)
   ├── Tạo Payment intent (Stripe)
   └── Trả về { orderId, orderNumber, paymentClientSecret }

3. Client thanh toán qua Stripe Elements

4. Stripe Webhook → /webhooks/stripe
   ├── payment_intent.succeeded
   │   ├── Cập nhật Order → CONFIRMED
   │   ├── Xóa Cart
   │   ├── Gửi email confirmation
   │   └── Trigger production queue
   └── payment_intent.payment_failed
       └── Cập nhật Order → CANCELLED (hoặc giữ PENDING cho retry)
```

---

## 7. Business Rules

- Order number format: `MLH-{YEAR}-{5_DIGIT_SEQUENCE}` (ví dụ: `MLH-2024-00042`).
- Hủy đơn chỉ trong **2 giờ** sau `confirmedAt`.
- Địa chỉ giao hàng **snapshot** vào order — không bị ảnh hưởng nếu user xóa địa chỉ sau.
- Giá sản phẩm **snapshot** vào `OrderItem.unitPrice` — không thay đổi dù admin sửa giá.
- Tất cả thao tác admin thay đổi status đều ghi `OrderStatusHistory`.
- Guest order track bằng `orderNumber + guestEmail`.
- Tự động chuyển sang `COMPLETED` sau **7 ngày** kể từ `DELIVERED` nếu không có dispute.
