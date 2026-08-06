# Module 26 — Creator Network (CREATOR-00→04)

## 1. Tổng quan

Creator Network là hệ thống multi-level referral cho phép users ("creators") chia sẻ EziHubb và kiếm hoa hồng khi community mua hàng. Bao gồm: landing page `/creators`, Creator Hub account pages, API layer, và admin management. Đây là hệ thống referral/commission thuần túy — không phải design submission system.

**Quan trọng:** Thuật ngữ "seller" đã bị xóa hoàn toàn. Route `/seller` không còn tồn tại. Thay thế: "creator" cho người dùng chia sẻ, "shop owner" cho người bán hàng.

## 2. Terminology

| Old Term | New Term |
|---|---|
| Seller/Influencer (referral context) | Creator |
| Referral Member | Creator |
| Seller route `/seller/*` (referral/influencer dashboard) | (deleted — no replacement in this module) |

> **Lưu ý:** Route `/[locale]/(seller)/seller/*` (products, orders, payouts, reviews, store) VẪN tồn tại trong client app — đây là dashboard quản lý cửa hàng cho "shop owner", KHÔNG liên quan đến referral/creator terminology. Bảng trên chỉ nói về việc xoá route `/seller` cũ từng dùng cho chức năng referral/influencer (nếu có), không phải toàn bộ `/seller/*`.

## 3. Creator Tiers (4 levels)

| Tier | Icon | Requirement | Commission Rate |
|---|---|---|---|
| Creator | 🎨 | Start here (0 members) | 10% |
| Rising Creator | 🌱 | 5+ direct members | 10.5% (+0.5%) |
| Top Creator | ⭐ | 20+ direct members | 11% (+1%) |
| Elite Creator | 💎 | 50+ direct members | 12% (+2%) |

- Tiered commission: Direct referral (Level 1) = 10%, Level 2 = 5%, Level 3 = 1%
- Buyer discount: 5% for anyone shopping through a creator link
- Lock period: 14 days before earnings confirmed

## 4. API Endpoints

> **Quan trọng:** "Creator" chỉ là lớp branding/alias ở tên constant và ở `CreatorController` — path thực tế phía server KHÔNG có prefix `/admin/creators`. Backend admin routes vẫn nằm dưới `/api/v1/admin/referrals/*` (`AdminReferralController`); chỉ tên constant phía FE (`ADMIN_CREATORS_*`) được đặt tên theo "creator" trong khi value trỏ tới `/admin/referrals/...`.

### Creator (authenticated) — `CreatorController`, `@Controller('creators')`, via API_ROUTES.CREATORS.*

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/creators/public-stats` | Public stats cho landing page (No auth) |
| GET | `/api/v1/creators/resolve?code=` | Resolve buyer discount cho checkout (No auth) |
| GET | `/api/v1/creators/me` | My creator profile (tier, referralCode, balances) |
| GET | `/api/v1/creators/me/earnings` | Paginated earnings history (level, status) |
| GET | `/api/v1/creators/me/tree` | Direct referrals (L1) |
| GET | `/api/v1/creators/me/withdrawals` | My payout requests (KHÔNG phải `/me/payouts`) |
| POST | `/api/v1/creators/me/withdrawals/request` | Request payout (paymentMethod, paymentDetail, amount) — KHÔNG phải `POST /me/payouts` |

> `CreatorController` dùng chung `ReferralService` với module Referral (spec 22 Part B) — không có model/service riêng cho "Creator".

### Admin — path thực tế `/api/v1/admin/referrals/*` (constant tên là `ADMIN_CREATORS_*` nhưng value trỏ referrals)

| Method | Path thực tế | Constant FE | Mô tả |
|---|---|---|---|
| GET | `/api/v1/admin/referrals/overview` | `ADMIN_CREATORS_OVERVIEW` | KPIs + top creators + recent commissions + payout queue |
| GET | `/api/v1/admin/referrals/users` | `ADMIN_CREATORS_MEMBERS` | Paginated creator list (search, tier filter) — path là `/users` không phải `/members` |
| GET | `/api/v1/admin/referrals/users/:id/tree` | `ADMIN_CREATORS_MEMBER_TREE` | Referral tree của 1 user |
| GET | `/api/v1/admin/referrals/payouts` | `ADMIN_CREATORS_PAYOUTS` | Payout requests (paginated, status filter) |
| POST | `/api/v1/admin/referrals/payouts/:id/pay` | `ADMIN_CREATORS_PAYOUT_PAY` | Mark payout PAID — là `POST`, không phải `PATCH` |
| POST | `/api/v1/admin/referrals/payouts/:id/reject` | `ADMIN_CREATORS_PAYOUT_REJECT` | Reject payout |
| GET/PATCH | `/api/v1/admin/referrals/settings` | `ADMIN_CREATORS_SETTINGS` | Creator/referral program settings (rates) |
| GET/POST | `/api/v1/admin/referrals/tiers` | `ADMIN_CREATORS_TIERS` | List/create tier — không có trong spec cũ |
| PATCH/DELETE | `/api/v1/admin/referrals/tiers/:id` | `ADMIN_CREATORS_TIER` | Update/xoá tier |

## 5. Data Shape (từ API responses)

```typescript
interface CreatorMe {
  referralCode:     string;
  creatorCode:      string;   // alias of referralCode, added by getCreatorMe()
  tier:             CreatorTier | null;  // null for new creators without tier
  directReferrals:  number;
  level2Referrals:  number;
  level3Referrals:  number;
  totalEarned:      number;
  pendingBalance:   number;
  confirmedBalance: number;
  // linkClicks: KHÔNG được trả về bởi getCreatorMe() hiện tại — không có tracking click nào cho Creator Network
}

interface CreatorTier {
  name:           string;
  badgeColor:     string;
  badgeIcon:      string;
  commissionRate: number;
  minReferrals:   number;
  nextTier?: { name: string; minReferrals: number };
}

interface Earning {
  id:        string;
  amount:    number;
  status:    'PENDING' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
  level:     number;      // 1 = direct, 2/3 = community
  orderId:   string | null;
  createdAt: string;
  lockedAt:  string | null;
}
```

Earning status dùng chung với referral system (không có model riêng — Creator Network là branding layer trên Referral System).

## 6. Frontend Pages (Client)

### Landing Page (Public)
Route: `/[locale]/creators`
File: `apps/client/src/app/[locale]/(storefront)/creators/page.tsx`

Content:
- Hero: "Turn your love for handmade gifts into real earnings"
- How it works (3 steps: Get your creator link → Share anything → Earn when they shop)
- Tier cards (Creator / Rising Creator / Top Creator / Elite Creator)
- Buyer discount section: "Your community gets 5% off every purchase"
- Testimonials grid
- Final CTA → `/auth/register`

No application needed — every registered user automatically gets a creator link.

### Creator Hub (Account)
Route base: `/[locale]/account/creator/`
Files: `apps/client/src/app/[locale]/(account)/account/creator/`

Sub-pages:
- `/account/creator` — Dashboard: tier hero card, KPI row (members/available/earned/link clicks), creator link card with share buttons (Twitter, Facebook, Pinterest, WhatsApp), recent earnings table
- `/account/creator/earnings` — Full earnings history (paginated, status filter, balance summary)
- `/account/creator/payouts` — Payout request form + payout history

Creator link format: `{origin}/search?c={referralCode}`

KPI cards on hub:
- Direct Members (Users icon, purple)
- Available balance (DollarSign icon, green)
- Total Earned all time (TrendingUp icon, primary)
- Link Clicks this month (MousePointer icon, blue) — UI đọc `me.linkClicks`, nhưng `GET /creators/me` hiện **không trả field này** (`getCreatorMe()` không có `linkClicks` trong response) → card này luôn hiển thị 0 trên thực tế

## 7. Admin Pages

File: `apps/admin/src/app/(admin)/creators/page.tsx` — Overview page

Sections on overview:
- KPI cards: Total Creators / Active This Month / Total Paid Out / Pending Earnings
- Commission Pipeline: Pending / Confirmed / Paid (with bar visualization)
- Top Creators table (click row → CreatorDrawer side panel)
- Recent Earnings table
- Payout Requests queue (with pagination)
- Commission Rates display (L1 10% / L2 5% / L3 1%) → link to settings

Sub-pages:
- `apps/admin/src/app/(admin)/creators/members/page.tsx` — Full creator list (search by email, tier filter)
- `apps/admin/src/app/(admin)/creators/payouts/page.tsx` — All payout requests
- `apps/admin/src/app/(admin)/creators/settings/page.tsx` — Commission rates + buyer discount config

## 8. Business Rules

- Every user automatically has a `referralCode` — no application required
- Creator link: append `?c={referralCode}` to any page URL
- Buyer discount: 5% applied automatically at checkout when `c` param present
- Earnings locked 14 days → CONFIRMED → available for withdrawal
- Commission is a multi-level referral commission (same system as Referral module, creator branding)
- Payout processed manually by admin (no auto-payout)
- Tier upgrade is automatic based on `directReferrals` count
