# Module 24 — FCM Push Notifications & Low-Stock Alerts

## Part A — FCM Push Notifications (P3-03)

### A1. Tổng quan

Firebase Cloud Messaging (FCM) cho push notifications trên browser/PWA. Khách hàng opt-in, nhận thông báo order status, loyalty points, messages.

### A2. API Endpoints

| Method | Path | Mô tả | Auth |
|---|---|---|---|
| POST | `/api/v1/push/register` | Đăng ký FCM token | Bearer |
| DELETE | `/api/v1/push/register/{token}` | Huỷ đăng ký token | Bearer |
| GET | `/api/v1/push/tokens/me` | Danh sách tokens của user | Bearer |

### A3. Prisma Model

```prisma
model FcmToken {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  userAgent String?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

### A4. Firebase Setup

- Package: `firebase-admin`
- Env: `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- Service: `FcmService` (`apps/api/src/modules/push/fcm.service.ts`)
- Service: `PushService` — high-level wrapper with event hooks

### A5. Service Worker (Dynamic Route)

Route: `apps/client/src/app/firebase-messaging-sw.js/route.ts`
- Dynamic Next.js route serving SW JavaScript
- Injects `NEXT_PUBLIC_FIREBASE_CONFIG` at runtime
- SW handles background message display

### A6. Client Integration

File: `apps/client/src/components/auth/AuthProvider.tsx` (hook)

```typescript
// On login: request notification permission → get FCM token → POST /push/register
// On logout: DELETE /push/register/{token}
```

### A7. Push Notification Events (3 triggers)

| Event | Title | Body |
|---|---|---|
| Order status changed | "Order Update" | "Your order #{orderNumber} is now {status}" |
| Loyalty points unlocked | "Points Unlocked!" | "You now have X points available" |
| New admin message reply | "New Message" | "You have a reply on your message" |

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

---

## Part B — Low-Stock Alerts (P3-04)

### B1. Tổng quan

Hệ thống cảnh báo sắp hết hàng. Daily scan qua BullMQ (7am UTC), giảm tồn kho khi order confirmed, Redis dedup để tránh gửi email lặp.

### B2. Product Schema Additions

```prisma
model Product {
  // ... existing fields ...
  trackInventory    Boolean @default(false)  // bật/tắt theo dõi tồn kho
  lowStockThreshold Int     @default(5)      // cảnh báo khi quantity <= threshold
  // quantity field already exists
}
```

### B3. Low-Stock Flow

#### Order Trigger (real-time)
1. Order `CONFIRMED` → decrement `Product.quantity` by ordered amount
2. If `trackInventory && quantity <= lowStockThreshold`:
   - Check Redis dedup key `low-stock:{productId}` (TTL: 24h)
   - If not exists: send admin email + set Redis key
3. If `quantity <= 0`: `Product.status → INACTIVE` (out of stock)

#### Daily BullMQ Scan (7am UTC)
- Queue: `stock-alert-queue`
- Job: `daily-low-stock-scan`
- Cron: `0 7 * * *`
- Finds all products with `trackInventory: true && quantity <= lowStockThreshold && status: ACTIVE`
- Sends admin summary email (batch, not per-product)
- Redis dedup: skip products already alerted in last 24h

### B4. BullMQ Queue Setup

```typescript
// Queue: 'stock-alert-queue'
// Recurring job scheduled via BullMQ repeatable
// apps/api/src/modules/products/jobs/low-stock-scan.processor.ts
```

### B5. Admin Email Template

Template: `low-stock-alert.hbs`
- Subject: "Low Stock Alert — {N} products need attention"
- Lists product name, current qty, threshold, link to admin edit

### B6. Admin UI Integration

In Product edit (`PricingShippingTab`):
- Toggle: "Track inventory"
- Number input: "Low stock threshold" (shown when trackInventory: true)
- Display current stock quantity

### B7. Business Rules

- `trackInventory: false` → không decrement, không alert
- Redis dedup key TTL: 24h (tránh spam email)
- Daily scan chạy độc lập với order trigger (không bị bỏ sót)
- Out-of-stock → set `Product.status = INACTIVE` (không tự reactivate)
- Admin phải thủ công reactivate sau khi restocked
- Quantity không bao giờ < 0 (clamp to 0 trước khi save)
