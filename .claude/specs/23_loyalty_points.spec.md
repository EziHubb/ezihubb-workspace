# Module 23 — Loyalty & Points System (P3-01)

## 1. Tổng quan

Hệ thống tích điểm thưởng cho khách hàng. Earn khi mua hàng, redeem khi thanh toán. 14-day lock trước khi points có thể dùng. BullMQ auto-confirm.

## 2. API Endpoints

### Customer
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/loyalty/me` | Points balance + tier + history | Bearer |
| GET | `/api/v1/loyalty/me/transactions` | Toàn bộ giao dịch points (phân trang) | Bearer |
| POST | `/api/v1/loyalty/redeem` | Redeem points cho đơn hàng | Bearer |
| GET | `/api/v1/loyalty/preview` | Preview points sẽ earn từ cart | Bearer |

### Admin
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/loyalty/stats` | Tổng quan: points issued, redeemed, outstanding | ADMIN |
| GET | `/api/v1/admin/loyalty/transactions` | All transactions | ADMIN |
| POST | `/api/v1/admin/loyalty/adjust` | Manual adjust points for user | ADMIN |
| PATCH | `/api/v1/admin/loyalty/settings` | Update earn rate, redeem rate | ADMIN |

## 3. Prisma Models

```prisma
enum PointTransactionType {
  EARNED_ORDER     // earn from purchase
  REDEEMED         // spent on order
  REFUND_DEDUCTED  // cancelled/refunded → deduct earned
  ADMIN_ADJUST     // manual admin adjustment
  EXPIRED          // points expired (future feature)
}

model LoyaltyAccount {
  id             String   @id @default(cuid())
  userId         String   @unique
  pointsBalance  Int      @default(0)  // available (unlocked)
  pointsPending  Int      @default(0)  // locked (14-day)
  pointsLifetime Int      @default(0)  // total ever earned
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  user           User     @relation(fields: [userId], references: [id])
  transactions   PointTransaction[]
}

model PointTransaction {
  id          String               @id @default(cuid())
  accountId   String
  type        PointTransactionType
  points      Int                  // positive = earn, negative = spend
  orderId     String?
  description String?
  lockedUntil DateTime?            // for EARNED_ORDER: now + 14 days
  unlockedAt  DateTime?            // when BullMQ unlocks
  createdAt   DateTime             @default(now())
  account     LoyaltyAccount       @relation(fields: [accountId], references: [id])
}
```

## 4. Earn Rules

| Event | Points Earned |
|---|---|
| Order CONFIRMED | 10 pts per $1 spent (order total after discounts) |
| Order COMPLETED | Points unlocked (moved from pending → balance) |
| Order CANCELLED | Earned points deducted (refund_deducted) |

- Points earned in `PENDING` state for 14 days after order confirmation
- BullMQ job `loyalty-unlock` scheduled at `confirmedAt + 14d`

## 5. Redeem Rules

| Rate | Meaning |
|---|---|
| 100 pts = $1 | Redeem 100 points → $1 off order |

- Only `pointsBalance` (unlocked) can be redeemed
- Min redeem: 100 points ($1)
- Max redeem per order: capped at order total
- Redeem applies as discount in checkout flow

## 6. BullMQ Queue: `loyalty-unlock`

```typescript
// Job: unlock pending points after 14 days
interface LoyaltyUnlockJob {
  transactionId: string;
  userId: string;
  points: number;
}
// Scheduled delay = 14 * 24 * 60 * 60 * 1000 ms from confirmedAt
```

## 7. Checkout Integration

In `CreateOrderDto`:
```typescript
{
  loyaltyPointsToRedeem?: number;  // points to apply as discount
}
```

Server validates: `pointsToRedeem <= account.pointsBalance` and converts to discount amount.

Order stores:
```prisma
model Order {
  loyaltyPointsEarned  Int? // points queued (pending)
  loyaltyPointsRedeemed Int? // points spent on this order
}
```

## 8. Customer Dashboard Page

Route: `/[locale]/account/loyalty`

Components:
- Points balance card (available vs pending)
- Tier badge (future: Bronze/Silver/Gold)
- Earn history timeline
- Redeem summary

File: `apps/client/src/app/[locale]/(account)/account/loyalty/page.tsx`

## 9. Email Notification

- `loyalty-points-earned.hbs`: "You earned X points on order #MLH-..." (sent when CONFIRMED)
- `loyalty-points-unlocked.hbs`: "Your X points are now available!" (sent when unlocked)
- Queued via `email-queue`

## 10. Business Rules

- LoyaltyAccount auto-created on first earned transaction (lazy create)
- Soft prevent negative balance (redeem blocked if insufficient)
- Admin adjust: can be positive or negative, no lock period
- Points không expire (trừ khi thêm expiry feature sau)
- Rate configurable trong admin settings (earn: pts per dollar, redeem: pts per dollar)
- `POST /loyalty/preview` trả về points sẽ earn (based on current cart total) — không tạo transaction
