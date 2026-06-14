# Module 26 — Creator Network (CREATOR-00→04)

## 1. Tổng quan

Creator Network là hệ thống multi-level referral cho phép users ("creators") chia sẻ Daily Daisy và kiếm hoa hồng khi community mua hàng. Bao gồm: landing page `/creators`, Creator Hub account pages, API layer, và admin management. Đây là hệ thống referral/commission thuần túy — không phải design submission system.

**Quan trọng:** Thuật ngữ "seller" đã bị xóa hoàn toàn. Route `/seller` không còn tồn tại. Thay thế: "creator" cho người dùng chia sẻ, "shop owner" cho người bán hàng.

## 2. Terminology

| Old Term | New Term |
|---|---|
| Seller/Influencer | Creator |
| Referral Member | Creator |
| Seller route `/seller/*` | (deleted — no replacement in this module) |

## 3. Creator Tiers (4 levels)

| Tier | Icon | Requirement | Commission Rate |
|---|---|---|---|
| Creator | 🎨 | Start here (0 members) | 10% |
| Rising Creator | 🌱 | 5+ direct members | 10.5% (+0.5%) |
| Top Creator | ⭐ | 20+ direct members | 11% (+1%) |
| Elite Creator | 💎 | 50+ direct members | 12% (+2%) |

- Tiered commission: Direct referral (Level 1) = 10%, Level 2 = 5%, Level 3 = 1%
- Buyer discount: 5% for anyone shopping through a creator link
- Lock period: 14 days before earnings confirmed (same as loyalty system)

## 4. API Endpoints

### Creator (authenticated) — via API_ROUTES.CREATORS.*

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/creators/me` | My creator profile (tier, referralCode, balances) |
| GET | `/api/v1/creators/me/earnings` | Paginated earnings history (level, status, lockedAt) |
| GET | `/api/v1/creators/me/payouts` | My payout requests |
| POST | `/api/v1/creators/me/payouts` | Request payout (paymentMethod, paymentDetail, amount) |

### Admin — via API_ROUTES.ADMIN.ADMIN_CREATORS_*

| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/v1/admin/creators/overview` | KPIs + top creators + recent commissions + payout queue |
| GET | `/api/v1/admin/creators/members` | Paginated creator list (search, tier filter) |
| GET | `/api/v1/admin/creators/payouts` | Payout requests (paginated, status filter) |
| PATCH | `/api/v1/admin/creators/payouts/:id` | Update payout status (PAID/REJECTED) |
| GET | `/api/v1/admin/creators/settings` | Creator program settings (rates) |
| PATCH | `/api/v1/admin/creators/settings` | Update commission rates / buyer discount |

## 5. Data Shape (từ API responses)

```typescript
interface CreatorMe {
  referralCode:     string;
  tier:             CreatorTier | null;  // null for new creators without tier
  directReferrals:  number;
  level2Referrals:  number;
  level3Referrals:  number;
  totalEarned:      number;
  pendingBalance:   number;
  confirmedBalance: number;
  linkClicks?:      number;
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
- Link Clicks this month (MousePointer icon, blue)

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
