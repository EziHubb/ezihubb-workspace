# Module 27 — NFT & Web3 Features (NFT-01→11)

## 1. Tổng quan

Tích hợp NFT cho marketplace: drops, memberships, design licensing, creator DNA, bounties, Canva integration, và AI-powered pricing. Schema đã được push lên DB.

## 2. Feature List (11 features)

### NFT-01 — NFT Drops
Limited edition digital collectibles gắn với sản phẩm vật lý.

```prisma
model NftDrop {
  id          String   @id @default(cuid())
  productId   String?
  name        String
  description String?
  imageUrl    String
  totalSupply Int
  minted      Int      @default(0)
  price       Decimal  // USD price for claiming
  mintPrice   Decimal? // ETH price (future)
  startDate   DateTime
  endDate     DateTime?
  isActive    Boolean  @default(true)
  contractAddress String? // after on-chain deploy
  metadata    Json?
  createdAt   DateTime @default(now())
}

model NftClaim {
  id       String   @id @default(cuid())
  dropId   String
  userId   String
  tokenId  Int?     // NFT token ID after mint
  txHash   String?
  claimedAt DateTime @default(now())
  drop     NftDrop  @relation(fields: [dropId], references: [id])
  user     User     @relation(fields: [userId], references: [id])
}
```

**Endpoints:**
| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/nft/drops` | No |
| GET | `/api/v1/nft/drops/{id}` | No |
| POST | `/api/v1/nft/drops/{id}/claim` | Bearer |
| GET | `/api/v1/admin/nft/drops` | ADMIN |
| POST | `/api/v1/admin/nft/drops` | ADMIN |
| PATCH | `/api/v1/admin/nft/drops/{id}` | ADMIN |

---

### NFT-02 — NFT Memberships
Token-gated access tiers cho exclusive products/discounts.

```prisma
enum MembershipTier { BRONZE SILVER GOLD PLATINUM }

model NftMembership {
  id           String         @id @default(cuid())
  userId       String
  tier         MembershipTier
  tokenId      String?
  walletAddress String?
  isActive     Boolean        @default(true)
  expiresAt    DateTime?
  benefits     Json?          // { discountRate, earlyAccess, freeShipping }
  createdAt    DateTime       @default(now())
  user         User           @relation(fields: [userId], references: [id])
}
```

---

### NFT-03 — AI Pricing Engine
AI-assisted pricing suggestions cho creators based on design complexity, market trends.

```prisma
model AiPricingSuggestion {
  id          String   @id @default(cuid())
  productId   String?
  creatorId   String?
  suggestedPrice Decimal
  confidence  Float
  rationale   Json     // { factors: string[], comparables: [] }
  modelVersion String
  createdAt   DateTime @default(now())
}
```

**Endpoint:**
- `POST /api/v1/admin/ai/pricing-suggestion` — ADMIN
- `POST /api/v1/creators/me/ai/pricing-suggestion` — CREATOR

---

### NFT-04 — Design Licensing
Creators license designs với royalty on each sale.

```prisma
enum LicenseType { EXCLUSIVE NON_EXCLUSIVE COMMERCIAL PERSONAL }

model DesignLicense {
  id          String      @id @default(cuid())
  designId    String
  licenseeId  String       // buyer
  licensorId  String       // creator
  type        LicenseType
  royaltyRate Decimal      @default(0.05)
  isActive    Boolean      @default(true)
  expiresAt   DateTime?
  terms       String?
  createdAt   DateTime     @default(now())
}
```

---

### NFT-05 — Creator Bounties
Brands post design requests, creators submit, winner earns bounty.

```prisma
enum BountyStatus { OPEN REVIEWING AWARDED CLOSED }

model Bounty {
  id          String       @id @default(cuid())
  posterId    String       // brand/admin
  title       String
  description String
  reward      Decimal
  deadline    DateTime
  status      BountyStatus @default(OPEN)
  winnerId    String?
  createdAt   DateTime     @default(now())
  submissions BountySubmission[]
}

model BountySubmission {
  id          String   @id @default(cuid())
  bountyId    String
  creatorId   String
  designUrl   String
  description String?
  isWinner    Boolean  @default(false)
  createdAt   DateTime @default(now())
}
```

---

### NFT-06 — Canva Integration
Design via Canva Connect API, import into customizer or creator portfolio.

- Auth flow: OAuth with Canva
- Import design → convert to customizable template
- Env: `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`

**Endpoints:**
| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/integrations/canva/auth` | Bearer |
| GET | `/api/v1/integrations/canva/callback` | Bearer |
| GET | `/api/v1/integrations/canva/designs` | Bearer |
| POST | `/api/v1/integrations/canva/import/{designId}` | Bearer |

---

### NFT-07 — Design Trends
AI-generated trend analysis for creators.

```prisma
model DesignTrend {
  id         String   @id @default(cuid())
  category   String
  keywords   String[]
  imageUrls  String[]
  trendScore Float
  period     String   // e.g. "2026-Q2"
  source     String   // "internal" | "pinterest" | "etsy"
  createdAt  DateTime @default(now())
}
```

**Endpoint:** `GET /api/v1/creators/me/trends` — CREATOR

---

### NFT-08 — Creator DNA
Unique style fingerprint for each creator based on their portfolio.

```prisma
model CreatorDna {
  id          String   @id @default(cuid())
  creatorId   String   @unique
  styleVector Json     // embedding vector (array of floats)
  tags        String[] // auto-detected style tags
  colorPalette String[] // dominant colors
  updatedAt   DateTime @updatedAt
  creator     Creator  @relation(fields: [creatorId], references: [id])
}
```

- Auto-generated via AI image analysis on design upload
- Used for: creator recommendation, design trend matching

---

### NFT-09 — Token-Gated Products
Products only purchasable if user holds specific NFT.

```prisma
model TokenGate {
  id              String   @id @default(cuid())
  productId       String
  requiredTokenId String?  // specific NFT token
  contractAddress String   // NFT contract
  chainId         Int      @default(1) // Ethereum mainnet
  isActive        Boolean  @default(true)
}
```

---

### NFT-10 — Wallet Connect
Connect crypto wallet for NFT operations.

```prisma
model WalletConnection {
  id            String   @id @default(cuid())
  userId        String
  walletAddress String
  chainId       Int
  isVerified    Boolean  @default(false)
  verifiedAt    DateTime?
  createdAt     DateTime @default(now())
}
```

**Endpoints:**
| Method | Path | Auth |
|---|---|---|
| POST | `/api/v1/wallet/connect` | Bearer |
| POST | `/api/v1/wallet/verify` | Bearer |
| DELETE | `/api/v1/wallet/{id}` | Bearer |

---

### NFT-11 — NFT-backed Gift Cards
Gift cards as NFTs with blockchain provenance.

```prisma
model NftGiftCard {
  id           String   @id @default(cuid())
  giftCardId   String   @unique // links to GiftCard
  tokenId      String?
  contractAddress String?
  txHash       String?
  mintedAt     DateTime?
  createdAt    DateTime @default(now())
  giftCard     GiftCard @relation(fields: [giftCardId], references: [id])
}
```

## 3. Admin AI Features Section

A dedicated section in admin sidebar: "AI Features"

Pages:
- `/ai-features` — Dashboard: AI usage stats, model performance KPIs
- `/ai-features/pricing` — AI Pricing Suggestions
- `/ai-features/trends` — Design Trends
- `/ai-features/dna` — Creator DNA management
- `/ai-features/moderation` — AI content moderation queue

**Dashboard KPI Row** (added to main admin dashboard):
- AI pricing accuracy score
- Trend detection count
- Creator DNA profiles generated

## 4. Environment Variables

```
# NFT / Web3
ALCHEMY_API_KEY=...        # Ethereum RPC
NEXT_PUBLIC_CHAIN_ID=1     # 1=mainnet, 11155111=sepolia
NFT_CONTRACT_ADDRESS=...   # deployed NFT contract

# Canva
CANVA_CLIENT_ID=...
CANVA_CLIENT_SECRET=...
CANVA_REDIRECT_URI=...

# AI
OPENAI_API_KEY=...         # for pricing & DNA analysis
REPLICATE_API_KEY=...      # for design trend images
```

## 5. Implementation Notes

- NFT minting is async (webhook from blockchain)
- All monetary values still USD (not ETH)
- On-chain operations use Alchemy provider
- Token verification done server-side (signature check)
- Schema pushed — migration applied 2026-06-11
