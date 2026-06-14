# Module 27 — NFT & Web3 Features (NFT-01→11)

## 1. Tổng quan

Tích hợp các tính năng nâng cao: drop culture, fan memberships, AI-powered pricing, design licensing marketplace, creator bounties, Canva integration, trend-to-product pipeline, và Creator DNA. Schema đã được push lên DB. AI features dùng chung BullMQ queue `ai-features` với per-domain processors.

## 2. NFT numbering vs actual implementation

Lưu ý: numbering trong Prisma comment khác với spec ban đầu. Mapping thực tế từ schema:

| Schema Label | Feature |
|---|---|
| NFT-02 | Drop Culture (DropWaitlist) |
| NFT-05 | Fan Membership (StoreMembership) |
| NFT-06 | AI Pricing Optimizer (ABPricingTest) |
| NFT-07 | Design Licensing Marketplace (DesignAsset, DesignLicense, RoyaltyEarning) |
| NFT-08 | Design Bounty Board (DesignBounty, DesignBountyEntry) |
| NFT-09 | Canva Integration (CanvaIntegration) |
| NFT-10 | Trend → Product Pipeline (TrendProductDraft) |
| NFT-11 | Creator DNA (SocialConnection, CreatorDNAAnalysis) |

## 3. Feature Details

### NFT-01 (actual) — Drop Culture / Product Drops

Products can be configured as "drops" with waitlist, launch date, and quantity limit.

**Prisma Model:**
```prisma
model DropWaitlist {
  id         String    @id @default(cuid())
  productId  String
  email      String
  userId     String?
  notifiedAt DateTime?
  createdAt  DateTime  @default(now())
  @@unique([productId, email])
}
```

Product fields extended (on Product model):
- `isDrop Boolean @default(false)`
- `dropLaunchAt DateTime?`
- `dropQuantityLimit Int?`
- `dropWaitlistOpen Boolean @default(false)`
- `dropEndAt DateTime?`

**Endpoints (DropsController):**

| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/products/:slug/waitlist` | Optional (guest or bearer) |
| GET | `/api/v1/products/:slug/waitlist/count` | Public |
| PATCH | `/api/v1/seller/products/:id/drops` | Bearer (seller/store owner) |

---

### NFT-02 (actual) — Fan Membership (Store Memberships)

Stores can create paid memberships for fans. Subscribers get perks (set by store owner).

**Prisma Models:**
```prisma
model StoreMembership {
  id              String   @id @default(cuid())
  storeId         String
  name            String
  description     String   @db.Text
  price           Decimal  @db.Decimal(10, 2)
  perks           String[]
  isActive        Boolean  @default(true)
  subscriberCount Int      @default(0)
  mrr             Decimal  @default(0)
  subscriptions   StoreMembershipSubscription[]
}

model StoreMembershipSubscription {
  id                   String           @id @default(cuid())
  userId               String
  storeId              String
  membershipId         String
  status               MembershipStatus @default(ACTIVE)
  stripeSubscriptionId String           @unique
  stripeCustomerId     String
  currentPeriodEnd     DateTime
  cancelledAt          DateTime?
}
```

**Endpoints (MembershipsController):**

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/stores/:slug/membership` | Public |
| GET | `/api/v1/memberships/me/:storeId` | Bearer — check if user is fan |
| POST | `/api/v1/memberships/:membershipId/subscribe` | Bearer |
| DELETE | `/api/v1/memberships/:storeId/cancel` | Bearer |
| POST | `/api/v1/seller/membership` | Bearer (store owner) |
| PATCH | `/api/v1/seller/membership/:id` | Bearer (store owner) |
| GET | `/api/v1/seller/membership/stats` | Bearer (store owner) |

---

### NFT-03 (actual) — AI Pricing Optimizer (A/B Testing)

AI suggests optimal prices; seller can start A/B test. Auto-applies winner after test period.

**Prisma Models:**
```prisma
model ABPricingTest {
  id              String       @id @default(cuid())
  productId       String
  variantA        Decimal      // control price
  variantB        Decimal      // AI-suggested price
  status          ABTestStatus @default(RUNNING)
  startedAt       DateTime     @default(now())
  endsAt          DateTime
  impressionsA    Int          @default(0)
  conversionsA    Int          @default(0)
  impressionsB    Int          @default(0)
  conversionsB    Int          @default(0)
  autoApplyWinner Boolean      @default(true)
  recommendation  Json?        // AI reasoning
  conversionLiftPct Float?
  appliedAt       DateTime?
}

model PricingAnalyticsLog {
  id               String   @id @default(cuid())
  productId        String
  storeId          String
  currentPrice     Decimal
  recommendedPrice Decimal
  confidence       Float
  reasoning        String   @db.Text
  competitorData   Json?
}
```

**Seller Endpoints (PricingController — `/api/v1/seller/products/:id/pricing`):**

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/seller/products/:id/pricing/recommendation` | Bearer (store owner) |
| POST | `/api/v1/seller/products/:id/pricing/ab-test` | Bearer (store owner) |
| GET | `/api/v1/seller/products/:id/pricing/ab-test` | Bearer (store owner) |

**Admin Endpoints (AdminAiController — `/api/v1/admin/ai/pricing/*`):**

| Method | Path |
|---|---|
| GET | `/api/v1/admin/ai/pricing/stats` |
| GET | `/api/v1/admin/ai/pricing/tests` |
| POST | `/api/v1/admin/ai/pricing/tests/:id/end` |
| POST | `/api/v1/admin/ai/pricing/tests/:id/revert` |
| GET | `/api/v1/admin/ai/pricing/products/:productId/recommendation` |
| POST | `/api/v1/admin/ai/pricing/products/:productId/ab-test` |
| GET | `/api/v1/admin/ai/pricing/products/:productId/ab-test` |

---

### NFT-04 (actual) — Design Licensing Marketplace

Sellers list designs for license purchase by other stores. Supports royalty on subsequent sales.

**Prisma Models:**
```prisma
enum LicenseType  { EXCLUSIVE NON_EXCLUSIVE }
enum LicenseModel { ONE_TIME ROYALTY SUBSCRIPTION }
enum LicenseStatus { ACTIVE EXPIRED REVOKED }

model DesignAsset {
  id              String
  storeId         String      // licensor
  title           String
  previewImageUrl String
  fullResImageUrl String
  licenseType     LicenseType
  listingPrice    Decimal
  royaltyRate     Decimal?    // for ROYALTY license model
  licenseModel    LicenseModel
  isActive        Boolean     @default(true)
  licenseCount    Int         @default(0)
  tags            String[]
}

model DesignLicense {
  id                    String
  assetId               String
  licenseeStoreId       String
  licensorStoreId       String
  licenseType           LicenseType
  purchasePrice         Decimal
  royaltyRate           Decimal?
  platformFee           Decimal
  licensorEarnings      Decimal
  status                LicenseStatus @default(ACTIVE)
  stripePaymentIntentId String?
}

model RoyaltyEarning {
  id             String               @id @default(cuid())
  licenseId      String
  triggerOrderId String
  amount         Decimal
  status         RoyaltyEarningStatus @default(PENDING)
}
```

**Endpoints (DesignLicensingController):**

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/marketplace/designs` | Public (query: page, limit, licenseType, search) |
| GET | `/api/v1/marketplace/designs/:id` | Public |
| POST | `/api/v1/marketplace/designs/:id/license` | Bearer (store) |
| POST | `/api/v1/seller/designs` | Bearer (store) — list design for license |
| GET | `/api/v1/seller/licenses` | Bearer (store) — role: licensor | licensee |

**Client Page:** `/marketplace/designs`

---

### NFT-05 (actual) — Design Bounty Board

Brands post design requests with a reward; creators submit entries; poster selects winner.

**Prisma Models:**
```prisma
enum BountyStatus     { OPEN REVIEWING AWARDED CLOSED }
enum BountyEntryStatus { SUBMITTED SHORTLISTED WINNER REJECTED }

model DesignBounty {
  id            String
  posterId      String
  posterStoreId String?
  title         String
  brief         String   @db.Text
  budget        Decimal
  platformFee   Decimal
  winnerPayout  Decimal
  deadline      DateTime
  status        BountyStatus @default(OPEN)
  entryCount    Int          @default(0)
  entries       DesignBountyEntry[]
}

model DesignBountyEntry {
  id              String
  bountyId        String
  designerId      String
  previewImageUrl String
  fullResImageUrl String
  description     String?
  status          BountyEntryStatus @default(SUBMITTED)
}
```

**Endpoints (BountiesController):**

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/marketplace/bounties` | Public (query: page, limit, status) |
| GET | `/api/v1/marketplace/bounties/:id` | Public |
| POST | `/api/v1/marketplace/bounties` | Bearer — create bounty |
| POST | `/api/v1/marketplace/bounties/:id/entries` | Bearer — submit entry |
| POST | `/api/v1/marketplace/bounties/:id/select-winner` | Bearer — poster selects winner |
| GET | `/api/v1/marketplace/bounties/me` | Bearer — my bounties (as poster) |

**Client Page:** `/marketplace/bounties`

---

### NFT-06 (actual) — Canva Integration

OAuth with Canva; sellers publish product images from Canva designs.

**Prisma Model:**
```prisma
model CanvaIntegration {
  id           String    @id @default(cuid())
  userId       String    @unique
  canvaUserId  String    @unique
  accessToken  String
  refreshToken String?
  expiresAt    DateTime?
}
```

**Endpoints (CanvaController — `/api/v1/canva/*`):**

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/canva/authorize` | Bearer — redirects to Canva OAuth |
| GET | `/api/v1/canva/callback` | Public — OAuth callback |
| GET | `/api/v1/canva/products` | Bearer — seller's products |
| POST | `/api/v1/canva/publish` | Bearer — upload image (multipart/form-data) |
| GET | `/api/v1/canva/status` | Bearer — integration status |
| DELETE | `/api/v1/canva/disconnect` | Bearer |

**Env:** `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_REDIRECT_URI`

---

### NFT-07 (actual) — Trend → Product Pipeline

AI scans social platforms for trending topics → generates product design briefs + images → admin reviews drafts → creates real products.

**Prisma Model:**
```prisma
enum TrendDraftStatus { PENDING_REVIEW APPROVED REJECTED EXPIRED PRODUCT_CREATED }

model TrendProductDraft {
  id                   String
  storeId              String
  trendTopic           String
  trendEngagement      Int
  trendPlatform        String   @default("tiktok")
  designBrief          Json
  generatedImageUrl    String
  suggestedProductName String
  suggestedDescription String   @db.Text
  suggestedTags        String[]
  suggestedPrice       Decimal?
  status               TrendDraftStatus @default(PENDING_REVIEW)
  expiresAt            DateTime         // auto-expire old drafts
  ipScanStatus         String   @default("PENDING")
  trendDataSnapshot    Json?
  approvedProductId    String?
}
```

Trend sources: TikTok, Pinterest, Google Trends, Reddit, Amazon, Shopee, Taobao.

**Seller Endpoints (TrendsController — `/api/v1/seller/trends`):**

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/seller/trends` | Bearer (store) — list my drafts |
| GET | `/api/v1/seller/trends/topics` | Bearer — trending topics |
| POST | `/api/v1/seller/trends/generate` | Bearer — trigger generation |
| POST | `/api/v1/seller/trends/:draftId/approve` | Bearer — approve draft |
| POST | `/api/v1/seller/trends/:draftId/reject` | Bearer — reject draft |

**Admin Endpoints (AdminAiController — `/api/v1/admin/ai/trend-drafts/*`):**

| Method | Path |
|---|---|
| GET | `/api/v1/admin/ai/trend-drafts/pending-count` |
| GET | `/api/v1/admin/ai/trend-drafts` |
| POST | `/api/v1/admin/ai/trend-drafts/:id/approve` |
| POST | `/api/v1/admin/ai/trend-drafts/:id/reject` |
| POST | `/api/v1/admin/ai/trend-drafts/:id/create-product` |
| GET | `/api/v1/admin/ai/sources` — list trend sources |
| POST | `/api/v1/admin/ai/trends/trigger-scan` — trigger immediate scan |

---

### NFT-08 (actual) — Creator DNA

Analyzes admin user's social media content to identify their creative style, audience, and generate personalized product ideas.

**Prisma Models:**
```prisma
enum CreatorDNAStatus { PENDING PROCESSING COMPLETED FAILED }

model SocialConnection {
  id             String
  userId         String
  platform       String      // "tiktok" | "instagram"
  accessToken    String
  refreshToken   String?
  expiresAt      DateTime?
  platformUserId String?
  @@unique([userId, platform])
}

model CreatorDNAAnalysis {
  id            String
  userId        String
  storeId       String
  platform      String
  analysisData  Json?
  insights      Json?
  status        CreatorDNAStatus @default(PENDING)
  postsAnalyzed Int              @default(0)
  draftsGenerated Int            @default(0)
}
```

**Endpoints (CreatorDnaController — `/api/v1/creator-dna`):**

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/creator-dna/tiktok/connect` | Bearer — redirect to TikTok OAuth |
| GET | `/api/v1/creator-dna/tiktok/callback` | Public — OAuth callback |
| GET | `/api/v1/creator-dna/instagram/connect` | Bearer — redirect to Instagram OAuth |
| GET | `/api/v1/creator-dna/instagram/callback` | Public — OAuth callback |
| GET | `/api/v1/creator-dna/analysis` | Bearer — get my DNA analysis |
| GET | `/api/v1/creator-dna/platforms` | Bearer — connected platforms |
| DELETE | `/api/v1/creator-dna/platforms/:platform` | Bearer — disconnect |

**Admin Endpoints (AdminAiController — `/api/v1/admin/ai/creator-dna/*`):**

| Method | Path |
|---|---|
| GET | `/api/v1/admin/ai/creator-dna` |
| POST | `/api/v1/admin/ai/creator-dna/:id/reanalyze` |
| GET | `/api/v1/admin/ai/creator-dna/platforms` |
| DELETE | `/api/v1/admin/ai/creator-dna/platforms/:platform` |
| POST | `/api/v1/admin/ai/creator-dna/fetch` |

---

## 4. AI Features BullMQ Queue

Queue name: `ai-features` (QUEUES.AI_FEATURES)

All AI work is processed through a single `AiFeaturesProcessor` that routes by job name:

```typescript
// Job names (AI_JOBS constant)
ANALYZE_PRICING     → PricingProcessor
EVALUATE_AB_TEST    → PricingProcessor
RECORD_IMPRESSION   → PricingProcessor
RECORD_CONVERSION   → PricingProcessor
FETCH_TRENDS        → TrendsProcessor
GENERATE_DESIGN_BRIEF → TrendsProcessor
GENERATE_DESIGN_IMAGE → TrendsProcessor
EXPIRE_OLD_DRAFTS   → TrendsProcessor
FETCH_SOCIAL_DATA   → CreatorDnaProcessor
ANALYZE_AUDIENCE    → CreatorDnaProcessor
```

## 5. Admin AI Section

Admin sidebar section: "AI"

Pages:
- `apps/admin/src/app/(admin)/ai/creator-dna/page.tsx` — Creator DNA management
- `apps/admin/src/app/(admin)/ai/pricing/page.tsx` — A/B pricing tests dashboard
- `apps/admin/src/app/(admin)/ai/trends/page.tsx` — Trend drafts management
- `apps/admin/src/app/(admin)/ai/usage/page.tsx` — AI API usage + cost metrics
- `apps/admin/src/app/(admin)/ai/settings/page.tsx` — AI feature settings

**Admin AI API Stats endpoints:**

| Method | Path |
|---|---|
| GET | `/api/v1/admin/ai/stats` — overall stats |
| GET | `/api/v1/admin/ai/settings` |
| PUT | `/api/v1/admin/ai/settings` |
| GET | `/api/v1/admin/ai/usage` — cost metrics (query: `days`) |

## 6. Client Pages

- `/marketplace/bounties` — Design Bounty Board (public)
- `/marketplace/designs` — Design Licensing Marketplace (public)
- `/mystery/[orderId]` — Mystery box reveal (linked to blind-match feature)

## 7. Environment Variables

```
# Canva
CANVA_CLIENT_ID=...
CANVA_CLIENT_SECRET=...
CANVA_REDIRECT_URI=...

# AI (pricing + DNA + trends)
OPENAI_API_KEY=...          # GPT-4 for brief generation, DNA analysis
REPLICATE_API_KEY=...       # image generation for trend drafts

# Creator DNA OAuth
TIKTOK_CLIENT_KEY=...
TIKTOK_CLIENT_SECRET=...
INSTAGRAM_APP_ID=...
INSTAGRAM_APP_SECRET=...
```

## 8. Implementation Notes

- Schema pushed — migration applied 2026-06-11
- No actual blockchain/NFT minting — features use naming ("drop", "membership") but are web2 implementations
- Trend pipeline: async image generation via BullMQ → admin reviews before product creation
- Creator DNA: processes social posts to identify niches, recommends trending product ideas
- A/B pricing: splits traffic 50/50, auto-applies winner at test end if `autoApplyWinner=true`
- Design licensing royalties: triggered per-order via hook in order completion flow
