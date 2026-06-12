# Module 26 — Creator Network (CREATOR-00→04)

## 1. Tổng quan

Creator Network là hệ thống cho phép artists/designers ("creators") bán designs trên nền tảng. Bao gồm: landing page `/creators`, Creator Hub account pages, API layer, và homepage CTA.

## 2. Terminology

| Old Term | New Term |
|---|---|
| Influencer | Creator |
| Partner | Creator Partner |
| Referral Member | Network Creator |

## 3. API Endpoints

### Public
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/creators` | List active creators (public profile) | No |
| GET | `/api/v1/creators/{username}` | Creator public profile + portfolio | No |
| POST | `/api/v1/creators/apply` | Apply to become creator | Optional |

### Creator (authenticated)
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/creators/me` | My creator profile | Bearer (CREATOR) |
| PATCH | `/api/v1/creators/me` | Update creator profile | Bearer (CREATOR) |
| GET | `/api/v1/creators/me/earnings` | Earnings dashboard | Bearer (CREATOR) |
| GET | `/api/v1/creators/me/designs` | My submitted designs | Bearer (CREATOR) |
| POST | `/api/v1/creators/me/designs` | Submit new design | Bearer (CREATOR) |
| PATCH | `/api/v1/creators/me/designs/{id}` | Update design | Bearer (CREATOR) |

### Admin
| Method | Path | Mô tả | Auth |
|---|---|---|---|
| GET | `/api/v1/admin/creators` | All creator applications | ADMIN |
| PATCH | `/api/v1/admin/creators/{id}/status` | Approve/reject/suspend creator | ADMIN |
| GET | `/api/v1/admin/creators/{id}/earnings` | Creator earnings detail | ADMIN |
| POST | `/api/v1/admin/creators/{id}/payout` | Process payout | ADMIN |

## 4. Prisma Models

```prisma
enum CreatorStatus { PENDING APPROVED REJECTED SUSPENDED }

model Creator {
  id           String        @id @default(cuid())
  userId       String        @unique
  username     String        @unique   // public URL slug
  displayName  String
  bio          String?
  avatarUrl    String?
  portfolioUrl String?
  socialLinks  Json?         // { instagram, tiktok, twitter, website }
  status       CreatorStatus @default(PENDING)
  commissionRate Decimal     @default(0.15)  // 15% of product revenue
  totalEarned  Decimal       @default(0)
  totalPaid    Decimal       @default(0)
  isVerified   Boolean       @default(false)
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  user         User          @relation(fields: [userId], references: [id])
  designs      CreatorDesign[]
}

model CreatorDesign {
  id          String   @id @default(cuid())
  creatorId   String
  productId   String?  // linked product (after approval)
  title       String
  description String?
  imageUrl    String
  status      String   @default("PENDING")  // PENDING | APPROVED | REJECTED
  createdAt   DateTime @default(now())
  creator     Creator  @relation(fields: [creatorId], references: [id])
}
```

## 5. Role Extension

```prisma
enum Role { CUSTOMER CREATOR ADMIN SUPER_ADMIN }
```

- User với `role: CREATOR` có quyền truy cập creator endpoints
- Creator cũng là Customer (có thể mua hàng)

## 6. Frontend Pages

### Landing Page (Public)
Route: `/[locale]/creators`
File: `apps/client/src/app/[locale]/(storefront)/creators/page.tsx`

Content:
- Hero: "Share your creativity. Earn with every sale."
- How it works (3 steps: Apply → Design → Earn)
- Creator showcase grid (approved creators with portfolio previews)
- Apply CTA

### Creator Profile (Public)
Route: `/[locale]/creators/[username]`
- Creator bio + social links
- Design portfolio grid
- Products featuring their designs

### Creator Hub (Account)
Route: `/[locale]/account/creator`
File: `apps/client/src/app/[locale]/(account)/account/creator/`

Sub-pages:
- `/account/creator` — Dashboard (earnings overview, design counts)
- `/account/creator/designs` — Design portfolio management
- `/account/creator/designs/new` — Upload new design
- `/account/creator/earnings` — Earnings history + payout status
- `/account/creator/profile` — Edit public creator profile

### Homepage CTA
Section in homepage: `CreatorCTASection.tsx`
- "Are you a creator?" call-to-action banner
- Links to `/creators` landing page

## 7. Commission Flow

1. Creator design approved → linked to `Product`
2. Order includes product with creator design → `CreatorEarning` created
3. Order `COMPLETED` → earning confirmed
4. Admin processes payout → `totalPaid` incremented

## 8. Admin UI

File: `apps/admin/src/app/(admin)/creators/page.tsx`
- Table: creator name, username, status, design count, earnings
- Application review: approve/reject with reason
- Earnings management + payout button

## 9. Business Rules

- Creator application requires: display name, bio, portfolio URL or sample designs
- Commission rate default: 15% of product `basePrice`
- Rates negotiable per creator (admin can override)
- Creator can submit unlimited designs
- Design approval required before linking to products
- Payout processed manually by admin (no auto-payout)
- Creator username must be unique, URL-safe, 3-30 chars
