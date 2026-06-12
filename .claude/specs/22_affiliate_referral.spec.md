# Module 22 — Affiliate Program & Multi-Level Referral System

## 1. Tổng quan

Hai hệ thống commission riêng biệt nhưng liên quan:
- **Affiliate Program** (AFFIL-01→05): Influencer/partner nhận commission khi giới thiệu đơn hàng
- **Multi-Level Referral** (REFER-00→06): Customer giới thiệu customer, 3 cấp (L1/L2/L3), có buyer discount

---

## Part A — Affiliate Program

### A1. API Endpoints

#### Public / Customer
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/affiliate/me` | Dashboard affiliate của tôi | Bearer |
| GET | `/api/v1/affiliate/me/commissions` | Lịch sử commission (phân trang) | Bearer |
| GET | `/api/v1/affiliate/me/payouts` | Lịch sử payout | Bearer |
| POST | `/api/v1/affiliate/apply` | Đăng ký affiliate | Bearer |
| GET | `/api/v1/affiliate/track/{code}` | Track affiliate link click | No |

#### Admin
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/affiliates` | List all affiliates | ADMIN |
| GET | `/api/v1/admin/affiliates/{id}` | Chi tiết affiliate + stats | ADMIN |
| PATCH | `/api/v1/admin/affiliates/{id}` | Update affiliate (status, rate) | ADMIN |
| GET | `/api/v1/admin/affiliates/{id}/commissions` | Commission list | ADMIN |
| POST | `/api/v1/admin/affiliates/{id}/payout` | Mark commission as paid | ADMIN |
| DELETE | `/api/v1/admin/affiliates/{id}` | Deactivate affiliate | ADMIN |

### A2. Prisma Models

```prisma
enum AffiliateStatus    { PENDING APPROVED REJECTED SUSPENDED }
enum CommissionStatus   { PENDING APPROVED PAID CANCELLED }

model Affiliate {
  id             String          @id @default(cuid())
  userId         String          @unique
  code           String          @unique   // referral code
  status         AffiliateStatus @default(PENDING)
  commissionRate Decimal         @default(0.05)  // 5%
  totalEarned    Decimal         @default(0)
  totalPaid      Decimal         @default(0)
  pendingAmount  Decimal         @default(0)
  clickCount     Int             @default(0)
  createdAt      DateTime        @default(now())
  user           User            @relation(fields: [userId], references: [id])
  commissions    AffiliateCommission[]
}

model AffiliateCommission {
  id          String           @id @default(cuid())
  affiliateId String
  orderId     String
  amount      Decimal
  rate        Decimal
  status      CommissionStatus @default(PENDING)
  approvedAt  DateTime?
  paidAt      DateTime?
  createdAt   DateTime         @default(now())
  affiliate   Affiliate        @relation(fields: [affiliateId], references: [id])
}

model AffiliateLinkClick {
  id          String   @id @default(cuid())
  affiliateId String
  ip          String?
  userAgent   String?
  createdAt   DateTime @default(now())
}
```

### A3. Commission Flow

1. Buyer click link `/?ref=<affiliateCode>` → cookie `mlh-aff=<code>` (TTL: 30 ngày)
2. Buyer đặt hàng → `POST /orders` reads cookie, links order to affiliate
3. Order → `CONFIRMED` → `AffiliateCommission` created với status `PENDING`
4. Order → `COMPLETED` → commission approved (`APPROVED`)
5. Order cancelled/refunded → commission `CANCELLED`
6. Admin manual payout: PATCH commission → `PAID`

### A4. Buyer Discount

- Khi order có affiliate cookie: buyer nhận discount tùy theo cấu hình affiliate
- Áp dụng như coupon tự động (không cần input code)

### A5. Self-Serve Portal (Client)

Route: `/[locale]/account/affiliate`
- Dashboard: clicks, conversions, earnings, pending payout
- Referral link generator với copy-to-clipboard
- Commission history table
- Payout request (khi pendingAmount >= $50)

### A6. Admin UI

File: `apps/admin/src/app/(admin)/affiliates/page.tsx`
- Table: affiliate name, code, status, conversions, earnings
- Detail modal: stats + commission list
- Approve/reject/suspend controls
- Manual payout action

### A7. Business Rules

- Commission calculated on order `total` (after discounts, before tax)
- Default rate: 5% (overridable per affiliate)
- Cookie-based tracking (30-day window)
- Commission locked when order `COMPLETED` (không phải khi CONFIRMED)
- Min payout threshold: $50

---

## Part B — Multi-Level Referral System

### B1. API Endpoints

#### Customer
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/referrals/me` | My referral stats + tree (L1/L2/L3) | Bearer |
| GET | `/api/v1/referrals/me/commissions` | Commission history | Bearer |
| POST | `/api/v1/referrals/me/share` | Generate/refresh share link | Bearer |
| GET | `/api/v1/referrals/join/{code}` | Join via referral (redirect) | No |

#### Admin
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/referrals` | List all referral relationships | ADMIN |
| GET | `/api/v1/admin/referrals/stats` | Network stats | ADMIN |
| GET | `/api/v1/admin/referrals/{userId}/tree` | User's referral tree | ADMIN |
| PATCH | `/api/v1/admin/referrals/settings` | Update commission rates | ADMIN |

### B2. Prisma Models

```prisma
model ReferralNode {
  id           String   @id @default(cuid())
  userId       String   @unique
  referrerCode String?  // code người giới thiệu
  referrerId   String?  // userId người giới thiệu (L1 parent)
  l1ParentId   String?  // direct referrer
  l2ParentId   String?  // L2 grandparent
  l3ParentId   String?  // L3 great-grandparent
  code         String   @unique  // this user's shareable code
  totalReferrals Int    @default(0)
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userId], references: [id])
}

model ReferralCommission {
  id          String           @id @default(cuid())
  userId      String           // earner
  orderId     String
  sourceUserId String          // who placed the order
  level       Int              // 1, 2, or 3
  amount      Decimal
  rate        Decimal
  status      CommissionStatus @default(PENDING)
  paidAt      DateTime?
  createdAt   DateTime         @default(now())
}
```

### B3. Commission Structure (3 cấp)

| Level | Người nhận | Rate mặc định |
|---|---|---|
| L1 | Direct referrer | 5% |
| L2 | L1's referrer | 2% |
| L3 | L2's referrer | 1% |

- Rates configurable trong admin settings
- Chỉ tính khi order → `CONFIRMED`
- Huỷ order → cancel commissions

### B4. Buyer Discount

- Người mua qua referral link nhận discount (default: 3%)
- Áp dụng tự động, không cần input code

### B5. Customer Hub

Route: `/[locale]/account/referrals`
- Referral tree visualization (L1/L2/L3 counts)
- Commission summary card
- Share link + social share buttons (Facebook, Twitter, copy)
- Commission history table

### B6. Share Button Component

File: `apps/client/src/components/referral/ReferralSharePanel.tsx`
- Copy-to-clipboard referral URL
- Social share: Facebook, Twitter, WhatsApp, Email
- QR code option

### B7. Business Rules

- Tự đăng ký không được tạo commission cho chính mình
- L1 commission cộng dồn không giới hạn referral count
- L2/L3 commission chỉ tính khi L1 tồn tại
- Commission chỉ tạo một lần per order (idempotency)
- Referral code là permanent (không thể đổi)
