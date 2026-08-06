# Module 22 — Affiliate Program & Multi-Level Referral System

## 1. Tổng quan

Hai hệ thống commission riêng biệt nhưng liên quan:
- **Affiliate Program** (AFFIL-01→05): Influencer/partner nhận commission khi giới thiệu đơn hàng
- **Multi-Level Referral** (REFER-00→06): Customer giới thiệu customer, 3 cấp (L1/L2/L3), có buyer discount

---

## Part A — Affiliate Program

### A1. API Endpoints

> **Lưu ý:** Prefix thực tế là `/api/v1/affiliates` (số nhiều), không phải `/api/v1/affiliate`.

#### Public / Customer (prefix `/api/v1/affiliates`)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/affiliates/settings/public` | Program settings công khai (commission %, discount %) | No |
| GET | `/affiliates/resolve?code=` | Resolve affiliate discount cho checkout banner | No |
| POST | `/affiliates/apply` | Nộp đơn đăng ký affiliate (không cần tài khoản — điền email/website riêng) | No (Public) |
| POST | `/affiliates/track` | Ghi nhận click (body: `referralCode`, `visitorId`, `landingPage`) | No |
| GET | `/affiliates/me` | Hồ sơ affiliate của tôi | Bearer |
| GET | `/affiliates/me/dashboard` | Dashboard: balance, stats, recent commissions | Bearer (status ACTIVE) |
| GET | `/affiliates/me/clicks` | Lịch sử click (phân trang) | Bearer (status ACTIVE) |
| GET | `/affiliates/me/payouts` | Lịch sử payout | Bearer (status ACTIVE) |
| POST | `/affiliates/me/payouts` | Gửi yêu cầu payout | Bearer (status ACTIVE) |

> Không có endpoint `/affiliates/me/commissions` riêng — commission gần đây nằm trong response của `/me/dashboard`.

#### Admin (prefix `/api/v1/admin/affiliates`)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/admin/affiliates/pending-count` | Đếm application đang PENDING (sidebar badge) | ADMIN |
| GET | `/admin/affiliates/settings` | Lấy affiliate program settings | ADMIN |
| PATCH | `/admin/affiliates/settings` | Update settings | ADMIN |
| GET | `/admin/affiliates/payouts` | List payout requests | ADMIN |
| POST | `/admin/affiliates/payouts/{id}/pay` | Đánh dấu payout đã trả | ADMIN |
| POST | `/admin/affiliates/payouts/{id}/reject` | Từ chối payout (hoàn lại balance) | ADMIN |
| GET | `/admin/affiliates` | List all affiliates (filter status, search) | ADMIN |
| GET | `/admin/affiliates/{id}` | Chi tiết affiliate + stats + commissions + clicks | ADMIN |
| POST | `/admin/affiliates/{id}/approve` | Duyệt application | ADMIN |
| POST | `/admin/affiliates/{id}/reject` | Từ chối application | ADMIN |
| PATCH | `/admin/affiliates/{id}` | Update status/commissionRate/notes | ADMIN |

> Không có `DELETE /admin/affiliates/{id}` — vô hiệu hoá affiliate bằng `PATCH` với `status: SUSPENDED`.

### A2. Prisma Models

```prisma
enum AffiliateStatus  { PENDING ACTIVE SUSPENDED REJECTED }
enum CommissionStatus { PENDING CONFIRMED APPROVED PAID CANCELLED }
enum PayoutStatus     { REQUESTED PROCESSING PAID REJECTED }

model AffiliateSettings {           // singleton row (id: "singleton")
  defaultRate       Decimal @default(0.10)  // 10%
  buyerDiscountRate Decimal @default(0.05)  // 5%
  cookieDays        Int     @default(30)
  minPayoutAmount   Decimal @default(50.00)
  lockDays          Int     @default(14)    // days after DELIVERED → CONFIRMED
  isEnabled         Boolean @default(true)
}

model AffiliateAccount {           // NOT named "Affiliate"
  id               String          @id @default(cuid())
  email            String          @unique   // affiliate may not be a registered customer
  firstName        String
  lastName         String
  website          String?
  promoDescription String?
  userId           String?         @unique   // optional link to a User (if also a buyer)
  referralCode     String          @unique
  commissionRate   Decimal?                  // null = use AffiliateSettings.defaultRate
  status           AffiliateStatus @default(PENDING)
  balance          Decimal @default(0)       // confirmed, unpaid
  totalEarned      Decimal @default(0)
  adminNotes       String?
  rejectedReason   String?
  approvedAt       DateTime?
  clicks           AffiliateClick[]
  commissions      AffiliateCommission[]
  payouts          AffiliatePayout[]
}

model AffiliateClick {
  id          String   @id @default(cuid())
  affiliateId String
  visitorId   String   // UUID from cookie
  ip          String?
  userAgent   String?
  landingPage String
  referrer    String?
  convertedAt DateTime? // set when visitor places an order
  orderId     String?
}

model AffiliateCommission {
  id          String           @id @default(cuid())
  affiliateId String
  orderId     String           @unique  // one commission per order
  baseAmount  Decimal                    // order subtotal used
  rate        Decimal                    // rate snapshot at order time
  amount      Decimal                    // baseAmount × rate
  status      CommissionStatus @default(PENDING)
  confirmedAt DateTime?
  cancelledAt DateTime?
}

model AffiliatePayout {           // separate model — spec cũ không có
  id            String       @id @default(cuid())
  affiliateId   String
  amount        Decimal
  status        PayoutStatus @default(REQUESTED)
  paymentMethod String       // "paypal" | "bank_transfer"
  paymentDetail String
  processedAt   DateTime?
  processedById String?
}
```

### A3. Commission Flow

1. Buyer click link `?ref=<referralCode>` → client `AffiliateTracker` component đọc cookie `ezihubb_affiliate` + `ezihubb_visitor` (TTL: `cookieDays`, mặc định 30 ngày) rồi `POST /affiliates/track` ghi `AffiliateClick`
2. Buyer đặt hàng có gắn affiliate → `AffiliateCommission` được tạo với status `PENDING` (`amount = baseAmount × rate`)
3. Order → `DELIVERED` → auto-confirm job được schedule chạy sau `lockDays` (mặc định 14 ngày) → commission chuyển `CONFIRMED`, cộng vào `AffiliateAccount.balance`
4. Order cancelled/refunded trước khi confirm → commission `CANCELLED`
5. Affiliate tự yêu cầu payout (`POST /affiliates/me/payouts`) → admin `POST /admin/affiliates/payouts/{id}/pay` → tất cả commission `CONFIRMED` của affiliate đó chuyển `PAID`

> **Lưu ý:** `CommissionStatus.APPROVED` tồn tại trong enum nhưng hiện không được dùng ở bất kỳ luồng code nào (flow thực tế bỏ qua APPROVED, đi thẳng CONFIRMED → PAID).

### A4. Buyer Discount

- Khi order có affiliate cookie: buyer nhận discount = `AffiliateSettings.buyerDiscountRate` (mặc định 5%)
- Áp dụng như coupon tự động (không cần input code)
- Hiển thị trong checkout: `AffiliateDiscountBanner.tsx`

### A5. Self-Serve Portal (Client)

Route: `/[locale]/affiliate/` (landing) + `/[locale]/affiliate/register` + `/[locale]/affiliate/(portal)/`
- Portal sub-routes: `dashboard`, `links`, `payouts`

### A6. Admin UI

Files:
- `apps/admin/src/app/(admin)/affiliates/page.tsx` — list + detail modal
- `apps/admin/src/app/(admin)/affiliates/[id]/page.tsx` — affiliate detail
- `apps/admin/src/app/(admin)/affiliates/payouts/page.tsx` — payout management
- `apps/admin/src/app/(admin)/settings/affiliates/page.tsx` — settings

### A7. Business Rules

- Commission calculated on `baseAmount` (order subtotal) × rate, snapshot tại thời điểm đặt hàng
- Default rate: **10%** (`AffiliateSettings.defaultRate`, overridable per affiliate qua `commissionRate`)
- Cookie-based tracking (`cookieDays`, mặc định 30 ngày)
- Commission lock/confirm được trigger khi order → `DELIVERED` (không phải `COMPLETED`), sau `lockDays` (mặc định 14 ngày)
- Min payout threshold: `minPayoutAmount` (mặc định $50)
- Affiliate application nộp công khai (không cần tài khoản) — xét duyệt qua PENDING → ACTIVE/REJECTED bởi admin

---

## Part B — Multi-Level Referral System

### B1. API Endpoints

> **Lưu ý:** Không có model "ReferralNode" riêng — cây referral (`referredByUserId`, `totalReferrals`, `referralDepth`, `referralBalance`, `referralCode`...) lưu trực tiếp trên model `User` (self-relation `ReferralTree`).

#### Customer (prefix `/api/v1/referrals`)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/referrals/resolve?code=` | Resolve buyer discount cho checkout (theo `User.referralCode`) | No |
| GET | `/referrals/me` | My referral stats, tier, settings (không kèm tree) | Bearer |
| GET | `/referrals/me/commissions` | Commission history (phân trang, filter status) | Bearer |
| GET | `/referrals/me/payouts` | Lịch sử payout | Bearer |
| POST | `/referrals/me/payouts/request` | Yêu cầu payout | Bearer |
| GET | `/referrals/me/tree` | Danh sách direct referrals (L1 only) | Bearer |

> Không có endpoint tạo/refresh share link hay "join via code" redirect — `referralCode` được cấp tự động khi tạo user; share link build ở client (`ReferralSharePanel.tsx`).

#### Admin (prefix `/api/v1/admin/referrals`)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/admin/referrals/overview` | Network stats tổng quan | SUPER_ADMIN/ADMIN |
| GET | `/admin/referrals/users` | List users kèm referral info (search, filter theo tier) | SUPER_ADMIN/ADMIN |
| GET | `/admin/referrals/users/{id}/tree` | User's referral tree | SUPER_ADMIN/ADMIN |
| PATCH | `/admin/referrals/users/{id}/balance` | Điều chỉnh balance thủ công (`delta`, `reason`) | SUPER_ADMIN/ADMIN |
| PATCH | `/admin/referrals/users/{id}/tier` | Override tier thủ công | SUPER_ADMIN/ADMIN |
| GET | `/admin/referrals/payouts` | List payout requests | SUPER_ADMIN/ADMIN |
| POST | `/admin/referrals/payouts/{id}/pay` | Đánh dấu payout đã trả | SUPER_ADMIN/ADMIN |
| POST | `/admin/referrals/payouts/{id}/reject` | Từ chối payout | SUPER_ADMIN/ADMIN |
| GET / PATCH | `/admin/referrals/settings` | Get/update commission rates + buyer discount | SUPER_ADMIN/ADMIN |
| GET / POST | `/admin/referrals/tiers` | List / create referral tiers | SUPER_ADMIN/ADMIN |
| PATCH / DELETE | `/admin/referrals/tiers/{id}` | Update / xoá tier | SUPER_ADMIN/ADMIN |

> Route thực tế là `/admin/referrals/users` (không phải `/admin/referrals` list "relationships"), và guard cho phép cả `ADMIN` lẫn `SUPER_ADMIN` (spec cũ ghi chỉ ADMIN).

### B2. Prisma Models

```prisma
// Referral tree lưu trực tiếp trên User — KHÔNG có model ReferralNode
model User {
  // ...
  referralCode        String?  @unique
  referredByUserId    String?
  referredBy          User?    @relation("ReferralTree", fields: [referredByUserId], references: [id])
  referrals           User[]   @relation("ReferralTree")
  referralDepth       Int      @default(0)
  totalReferrals      Int      @default(0)
  referralBalance     Decimal  @default(0)
  referralEarned      Decimal  @default(0)
  referralTierId      String?
  referralTier        ReferralTier? @relation(fields: [referralTierId], references: [id])
}

model ReferralTier {
  id              String  @id @default(cuid())
  name            String
  minReferrals    Int
  minEarned       Decimal
  commissionBonus Decimal @default(0)  // added on top of level1Rate
  badgeColor      String  @default("#888888")
  badgeIcon       String  @default("ti-star")
  sortOrder       Int     @default(0)
}

model ReferralCommission {
  id          String   @id @default(cuid())
  earnerId    String   // who earns the commission
  orderId     String
  buyerId     String   // who placed the order
  level       Int      // 1, 2, or 3
  rate        Decimal
  baseAmount  Decimal
  amount      Decimal
  status      ReferralCommissionStatus @default(PENDING) // PENDING CONFIRMED PAID CANCELLED
  confirmedAt DateTime?
  cancelledAt DateTime?

  @@unique([earnerId, orderId])
}

model ReferralPayout {
  id            String  @id @default(cuid())
  userId        String
  amount        Decimal
  status        ReferralPayoutStatus @default(REQUESTED) // REQUESTED PROCESSING PAID REJECTED
  paymentMethod String
  paymentDetail String
}

model ReferralSettings {           // singleton row (id: "singleton")
  level1Rate           Decimal @default(0.10)  // 10%
  level2Rate           Decimal @default(0.05)  // 5%
  level3Rate           Decimal @default(0.01)  // 1%
  buyerDiscountRate    Decimal @default(0.05)  // 5%
  buyerDiscountEnabled Boolean @default(true)
  minPayoutAmount      Decimal @default(50.00)
  lockDays             Int     @default(14)
  isEnabled            Boolean @default(true)
}
```

### B3. Commission Structure (3 cấp) & Tier Bonuses

| Level | Người nhận | Rate mặc định |
|---|---|---|
| L1 | Direct referrer | **10%** |
| L2 | L1's referrer | **5%** |
| L3 | L2's referrer | **1%** |

- Rates configurable trong `ReferralSettings` (admin settings API)
- `ReferralTier` cho phép cộng thêm `commissionBonus` vào level1Rate khi user đạt `minReferrals`/`minEarned` (auto hoặc admin override qua `PATCH /admin/referrals/users/{id}/tier`)
- Commission được tạo khi order đặt hàng (status `PENDING`); confirm giống affiliate flow — sau `lockDays` kể từ khi order `DELIVERED` → `CONFIRMED`, cộng vào `User.referralBalance`
- Huỷ order trước khi confirm → commission `CANCELLED`

### B4. Buyer Discount

- Người mua qua referral link nhận discount = `ReferralSettings.buyerDiscountRate` (default: **5%**, không phải 3%)
- Áp dụng tự động, không cần input code (resolve qua `GET /referrals/resolve?code=`)

### B5. Customer Hub

Route: `/[locale]/account/referrals`
- Sub-routes: `/account/referrals/earnings`, `/account/referrals/payouts`
- Referral tree visualization (L1/L2/L3 counts)
- Commission summary card
- Share link + social share buttons (Facebook, Twitter, copy)
- Commission history table

### B6. Share Button Component

File: `apps/client/src/components/referral/ReferralSharePanel.tsx`
- Copy-to-clipboard referral URL
- Social share: Facebook, Twitter, WhatsApp, Email
- QR code option

### B7. Admin UI

Files:
- `apps/admin/src/app/(admin)/referrals/page.tsx`
- `apps/admin/src/app/(admin)/referrals/users/page.tsx`
- `apps/admin/src/app/(admin)/referrals/payouts/page.tsx`
- `apps/admin/src/app/(admin)/referrals/settings/page.tsx`

### B8. Business Rules

- Tự đăng ký không được tạo commission cho chính mình
- L1 commission cộng dồn không giới hạn referral count
- L2/L3 commission chỉ tính khi L1 tồn tại
- Commission idempotent per order: `@@unique([earnerId, orderId])` trên `ReferralCommission`
- Referral code là permanent (không thể đổi) — cấp tự động khi tạo `User`
- Admin có thể điều chỉnh `referralBalance` thủ công (`PATCH /admin/referrals/users/{id}/balance`) hoặc override tier (`PATCH .../tier`) — không có trong bản spec trước
