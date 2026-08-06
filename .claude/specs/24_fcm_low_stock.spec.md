# Module 24 — FCM Push Notifications & Low-Stock Alerts

## Part A — FCM Push Notifications (P3-03)

### A1. Tổng quan

Firebase Cloud Messaging (FCM) cho push notifications trên browser/PWA. Khách hàng opt-in, nhận thông báo order status, messages.

### A2. API Endpoints

FCM token quản lý qua **users** controller (không phải push controller riêng):

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/users/me/fcm-token` | Đăng ký FCM token (upsert theo `token`; auto-trim còn tối đa 5 token/user, giữ token mới nhất theo `lastSeen`) | Bearer |
| DELETE | `/api/v1/users/me/fcm-token` | Huỷ đăng ký token | Bearer |
| PATCH | `/api/v1/users/me/push-preferences` | Bật/tắt push (`pushEnabled` trên `User`) | Bearer |

### A3. Prisma Model

```prisma
model FcmToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  platform  String   @default("web")  // "web" | "ios" | "android" — KHÔNG có field userAgent
  createdAt DateTime @default(now())
  lastSeen  DateTime @default(now())  // updated on each re-register; dùng để LRU-trim quá 5 token
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

`PushService.sendToUser()` kiểm tra `User.pushEnabled` trước khi gửi — nếu `false`, bỏ qua toàn bộ push cho user đó.

### A4. Firebase Setup

- Package: `firebase-admin`
- Env: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- Service: `FcmService` (`apps/api/src/modules/notifications/fcm.service.ts`)
- Service: `PushService` (`apps/api/src/modules/notifications/push.service.ts`) — high-level wrapper with event hooks
- Cả hai service đặt trong `notifications` module (không phải module `push` riêng biệt)

### A5. Service Worker (Dynamic Route)

Route: `apps/client/src/app/firebase-messaging-sw.js/route.ts`
- Dynamic Next.js route serving SW JavaScript
- Injects `NEXT_PUBLIC_FIREBASE_CONFIG` at runtime
- SW handles background message display

### A6. Client Integration

File: `apps/client/src/components/providers/AuthProvider.tsx`

```typescript
// On login: request notification permission → get FCM token → POST /users/me/fcm-token
// On logout: DELETE /users/me/fcm-token
```

### A7. Push Notification Events (2 triggers — `PushService` methods)

| Event | Method | Title | Body |
|---|---|---|---|
| Order shipped (không phải "bất kỳ status change" nào) | `notifyOrderShipped()` | "Your order is on its way! 🚚" | "Order #{orderNumber} shipped via {carrier}" |
| New shop reply on message | `notifyNewMessage()` | "EziHubb replied 💬" | "You have a new message from the shop" |

Mỗi hàm nhận `clickAction` deep-link riêng (`/account/orders/{orderNumber}`, `/account/messages`) và `data` payload có `type`.

> **Đã xoá:** `notifyPointsConfirmed()` — dùng cho loyalty points, module Loyalty đã bị xoá khỏi codebase.

### A8. Environment Variables

```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...
```

### A9. File Structure (API)

```
apps/api/src/modules/notifications/
  notifications.module.ts
  notifications.controller.ts  # Contact form, product-ready, newsletter
  notifications.service.ts
  fcm.service.ts               # Firebase Admin SDK wrapper
  push.service.ts              # High-level push event dispatcher
```

```
apps/api/src/modules/users/dto/
  fcm-token.dto.ts             # RegisterFcmTokenDto, UnregisterFcmTokenDto
```

---

## Part B — Low-Stock Alerts (P3-04)

### B1. Tổng quan

Hệ thống cảnh báo sắp hết hàng. Daily scan qua BullMQ (7am UTC), giảm tồn kho khi payment thành công (Stripe webhook), Redis dedup để tránh gửi email lặp.

### B2. Product Schema Additions

```prisma
model Product {
  // ... existing fields ...
  trackInventory    Boolean @default(false)  // bật/tắt theo dõi tồn kho
  lowStockThreshold Int?                     // KHÔNG có default 5 — nullable, phải set thủ công qua update DTO
  // quantity field đã có sẵn (Int?, nullable)
}
```

> `ProductVariant` cũng có field `lowStockThreshold Int?` riêng trong schema, nhưng `LowStockService` hiện chỉ đọc/ghi ở mức `Product`, không dùng field này ở variant level.

### B3. Low-Stock Flow

#### Order Trigger (real-time)
1. Stripe payment webhook thành công (`PaymentsService`) → fire-and-forget gọi `LowStockService.checkAfterOrder(orderId)` (không phải hook trực tiếp trên order status `CONFIRMED`)
2. Với mỗi product trong order có `trackInventory && quantity !== null`: decrement `Product.quantity` theo ordered amount
3. Sau decrement, phân loại: `isOutOfStock = quantity <= 0`; `isLowStock = !isOutOfStock && lowStockThreshold !== null && quantity <= lowStockThreshold`
4. Nếu out-of-stock hoặc low-stock: gọi `maybeAlert()` — check Redis dedup key `low_stock_alert:{productId}` (TTL: 24h, KHÔNG phải `low-stock:{productId}`); nếu chưa tồn tại → gửi email admin + set key
5. **Không có** bước tự động set `Product.status → INACTIVE` khi hết hàng — sản phẩm hết hàng chỉ được cảnh báo qua email, admin phải tự cập nhật status/quantity

#### Daily BullMQ Scan (7am UTC)
- Queue: `low-stock` (`QUEUES.LOW_STOCK`), KHÔNG phải `stock-alert-queue`
- Job: `daily-low-stock-scan` (`JOBS.DAILY_LOW_STOCK_SCAN`)
- Cron: `0 7 * * *` — repeatable job registered trong `LowStockProcessor.onModuleInit()`
- Quét tất cả products với `trackInventory: true && isActive: true && quantity !== null`
- **Gửi email riêng cho từng product** (một email/product qua cùng `maybeAlert()`), KHÔNG phải một email tổng hợp/batch như spec cũ mô tả
- Redis dedup (24h) dùng chung với order-trigger path nên tránh gửi trùng nếu đã alert gần đây

### B4. BullMQ Queue Setup

```typescript
// Queue: QUEUES.LOW_STOCK = 'low-stock'
// Job: JOBS.DAILY_LOW_STOCK_SCAN = 'daily-low-stock-scan'
// Recurring job scheduled via BullMQ repeatable, registered on module init
```

File processor (scheduler + worker): `apps/api/src/queue/low-stock.processor.ts` — gọi `LowStockService.dailyScan()`
File service (business logic): `apps/api/src/modules/products/low-stock.service.ts`

### B5. Admin Email Template

Template: `EmailTemplate.LOW_STOCK_ALERT` = `'low-stock-alert'`
- Subject thực tế theo từng product: `"Out of stock: {productName}"` hoặc `"Low stock alert: {productName} ({qty} remaining)"` — không phải subject tổng hợp "{N} products need attention"
- Data: productName, sku, quantity, threshold, status, isOutOfStock, adminProductUrl (`{ADMIN_URL}/products/{id}/edit`)

### B6. Admin UI Integration

Trong Product edit (`PricingShippingTab`):
- Toggle: "Track inventory"
- Number input: "Low stock threshold" (hiển thị khi trackInventory: true)
- Display current stock quantity

### B7. Business Rules

- `trackInventory: false` hoặc `quantity === null` → bỏ qua hoàn toàn (không decrement, không alert)
- Redis dedup key (`low_stock_alert:{productId}`) TTL: 24h (tránh spam email), dùng chung giữa order-trigger và daily scan
- Daily scan chạy độc lập với order trigger (không bị bỏ sót nếu miss event)
- **Out-of-stock KHÔNG tự động set `Product.status = INACTIVE`** — đây là điểm khác biệt so với spec cũ; hiện tại chỉ gửi email cảnh báo, admin phải tự xử lý status/quantity
- `lowStockThreshold` không có default — nếu admin không set, product sẽ không bao giờ trigger low-stock alert (chỉ out-of-stock ở quantity <= 0 vẫn hoạt động vì không phụ thuộc threshold)
- Không thấy code clamp `quantity` về 0 một cách tường minh trong `checkAfterOrder()` — decrement dùng Prisma `{ decrement: item.quantity } ` trực tiếp trên `Product.quantity`
