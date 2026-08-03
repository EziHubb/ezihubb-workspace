# Module 23 — Loyalty & Points System (P3-01)

## 1. Tổng quan

Hệ thống tích điểm thưởng cho khách hàng. Earn khi thanh toán thành công, redeem inline trong checkout. 14-day lock kể từ khi order `DELIVERED` trước khi points có thể dùng. BullMQ auto-confirm sau 14 ngày (queue `loyalty`, job `loyalty-confirm`).

## 2. API Endpoints

> **Lưu ý:** Không có admin endpoints riêng cho loyalty (`/admin/loyalty/*` không tồn tại) và không có endpoint `POST /loyalty/redeem` độc lập — redeem xảy ra inline trong checkout flow (xem mục 7). Cũng không có `/loyalty/me/transactions` riêng — 50 giao dịch gần nhất trả về kèm trong `/loyalty/me`.

### Customer (`LoyaltyController`, `@Controller('loyalty')`, toàn bộ route yêu cầu `JwtAuthGuard`)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/loyalty/me` | Points balance (balance/pending/lifetime) + 50 transactions gần nhất | Bearer |
| GET | `/api/v1/loyalty/preview?points=` | Preview discount ($ ) cho N points (không tạo transaction) | Bearer |
| GET | `/api/v1/loyalty/config` | Trả về config: pointsPerDollar, pointValue, minRedeemPoints, maxRedeemPercent, lockDays | Bearer |

> `preview` khác thiết kế cũ: nhận `points` (không phải cart total) và trả `{ valid, points, discount }` — dùng để preview số tiền giảm khi redeem N điểm ở checkout, không phải preview số điểm sẽ earn từ cart.

## 3. Prisma Models

```prisma
enum LoyaltyTxType {
  EARN    // purchase → pointsPending
  REDEEM  // used at checkout (from pointsBalance)
  CANCEL  // cancelled on refund
  EXPIRE  // future use
  ADJUST  // admin manual adjustment
}

model LoyaltyAccount {
  id             String   @id @default(cuid())
  userId         String   @unique
  pointsBalance  Int      @default(0)  // available (unlocked)
  pointsPending  Int      @default(0)  // locked (14-day)
  pointsLifetime Int      @default(0)  // total ever earned (never decrements)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  transactions   LoyaltyTransaction[]
}

model LoyaltyTransaction {
  id          String         @id @default(cuid())
  accountId   String
  orderId     String?        // nullable — adjust/expire have no order
  type        LoyaltyTxType
  points      Int            // positive = earn/restore; negative = redeem/cancel
  description String?
  confirmedAt DateTime?      // set when an EARN tx moves pending → balance
  createdAt   DateTime       @default(now())
  account     LoyaltyAccount @relation(fields: [accountId], references: [id], onDelete: Cascade)
}
```

> **Tên model/enum thực tế khác spec cũ:** `LoyaltyTransaction` (không phải `PointTransaction`), `LoyaltyTxType` (không phải `PointTransactionType`, và giá trị enum khác hoàn toàn: `EARN/REDEEM/CANCEL/EXPIRE/ADJUST`). Không có field `lockedUntil`/`unlockedAt` — chỉ có `confirmedAt` (null = còn pending).

## 4. Earn Rules

| Event | Points Earned |
|---|---|
| Payment confirmed (`PaymentsService.earnPoints`, sau khi order thanh toán thành công) | 10 pts per $1 của `earnableTotal` (order total trừ phần đã dùng points redeem) → cộng vào `pointsPending` + `pointsLifetime` |
| Order `DELIVERED` | `LoyaltyService.schedulePointsConfirm()` schedule BullMQ job sau `lockDays` (14 ngày) |
| Job chạy (14 ngày sau DELIVERED) | `confirmPoints()`: `pointsPending → pointsBalance` |
| Order cancelled/refunded (bất kỳ lúc nào) | `cancelPoints()`: trừ điểm earn (từ pending hoặc balance tuỳ đã confirm hay chưa), hoàn lại điểm đã redeem |

- Points earned ở trạng thái pending (`pointsPending`) trong 14 ngày sau khi order chuyển `DELIVERED` (không phải từ lúc order CONFIRMED)
- BullMQ queue `loyalty` (constant `QUEUES.LOYALTY`), job name `loyalty-confirm` (jobId: `loyalty-confirm-{orderId}`) — nếu order bị huỷ trước khi job chạy, job sẽ bị remove khỏi queue

## 5. Redeem Rules

| Rate | Ý nghĩa |
|---|---|
| 100 pts = $1 | Redeem 100 points → $1 off order (`POINT_VALUE = 0.01`) |

- Chỉ `pointsBalance` (unlocked) có thể redeem
- Min redeem: 100 points ($1) — `MIN_REDEEM_POINTS`
- **Max redeem per order: 50% order total** (`MAX_REDEEM_PERCENT = 0.50`) — không phải "capped tại order total" như bản cũ
- Redeem xảy ra inline trong checkout (`OrdersService.create()` → `LoyaltyService.redeemPoints()` trong cùng DB transaction với tạo order), không qua endpoint API riêng

## 6. BullMQ Queue: `loyalty`

```typescript
// Job name: 'loyalty-confirm' (AUTO_CONFIRM_JOB), queue: QUEUES.LOYALTY = 'loyalty'
// Payload: { orderId: string; userId: string }
// jobId: `loyalty-confirm-${orderId}` (idempotent, removable on cancel)
// delay = LOYALTY_CONFIG.LOCK_DAYS (14) * 24 * 60 * 60 * 1000 ms, scheduled khi order → DELIVERED
```

File processor: `apps/api/src/modules/loyalty/loyalty.processor.ts` (gọi `loyaltyService.confirmPoints(orderId, userId)`)

## 7. Checkout Integration

Trong checkout DTO (`apps/api/src/modules/orders/dto/checkout.dto.ts`):
```typescript
{
  pointsToRedeem?: number;  // NOT "loyaltyPointsToRedeem" — points to apply as discount, min 100
}
```

`OrdersService.create()`: validate `pointsToRedeem >= 100` → `LoyaltyService.validateRedemption()` (kiểm tra min, max 50% order total, đủ balance) → `redeemPoints()` trừ điểm trong transaction tạo order.

Order stores (field names KHÔNG có tiền tố `loyalty`):
```prisma
model Order {
  pointsEarned   Int?  // points awarded when this order completes
  pointsRedeemed Int?  // points spent to discount this order
}
```

## 8. Customer Dashboard Page

Route: `/[locale]/account/loyalty`
File: `apps/client/src/app/[locale]/(account)/account/loyalty/page.tsx`

Components:
- Points balance card (available vs pending)
- Tier badge (future: Bronze/Silver/Gold)
- Earn history timeline
- Redeem summary

## 9. Email Notifications

- Chỉ có **một** template thực tế: `loyalty-points-earned` — gửi từ `confirmPoints()` khi điểm mở khoá (14 ngày sau DELIVERED), KHÔNG gửi email riêng tại thời điểm earn ban đầu (spec cũ nhầm là 2 template cho 2 giai đoạn)
- Data: `firstName`, `points`, `balance`, `dollarValue`, `loyaltyUrl` (`{shopUrl}/account/loyalty`)
- Queued via `QUEUES.EMAIL` (`JOBS.SEND_EMAIL`), fire-and-forget
- Kèm push notification: `PushService.notifyPointsConfirmed(userId, pointsEarned)` cùng lúc

## 10. Business Rules

- `LoyaltyAccount` auto-created on first earned transaction (lazy create, `getOrCreateAccount()`)
- Redeem là atomic decrement có điều kiện (`updateMany` với `pointsBalance: { gte: points }`) — throw nếu không đủ, không thể âm balance
- Admin adjust: enum có `ADJUST` type nhưng **không có admin endpoint/UI** để thao tác — chỉ dùng nội bộ khi refund restore điểm đã redeem
- Points không expire (enum có `EXPIRE` cho tương lai, chưa implement job nào dùng)
- Rate/threshold là hằng số code (`LOYALTY_CONFIG` trong `loyalty.config.ts`), KHÔNG configurable qua admin settings API (không có `/admin/loyalty/settings`)
- `GET /loyalty/preview?points=` nhận số **points** muốn redeem và trả `{ valid, points, discount }` — không phải preview earn từ cart

## 11. File Structure (API)

```
apps/api/src/modules/loyalty/
  loyalty.module.ts
  loyalty.controller.ts
  loyalty.service.ts
  loyalty.processor.ts   # BullMQ processor
  loyalty.config.ts      # Earn/redeem rate config
  loyalty.service.spec.ts
```
