-- ── REFER-00: Multi-Level Referral System ────────────────────────────────────

-- 1. New enums
DO $$ BEGIN
  CREATE TYPE "ReferralCommissionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PAID', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ReferralPayoutStatus" AS ENUM ('REQUESTED', 'PROCESSING', 'PAID', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. ReferralTier (must exist before User FK)
CREATE TABLE IF NOT EXISTS "ReferralTier" (
  "id"              TEXT          NOT NULL,
  "name"            TEXT          NOT NULL,
  "minReferrals"    INTEGER       NOT NULL,
  "minEarned"       DECIMAL(10,2) NOT NULL,
  "commissionBonus" DECIMAL(5,4)  NOT NULL DEFAULT 0,
  "badgeColor"      TEXT          NOT NULL DEFAULT '#888888',
  "badgeIcon"       TEXT          NOT NULL DEFAULT 'ti-star',
  "sortOrder"       INTEGER       NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralTier_pkey" PRIMARY KEY ("id")
);

-- 3. Extend User with referral fields
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralCode"     TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referredByUserId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralDepth"    INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totalReferrals"   INTEGER       NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralBalance"  DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralEarned"   DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "referralTierId"   TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_referralCode_key"
  ON "User"("referralCode");

CREATE INDEX IF NOT EXISTS "User_referredByUserId_idx"
  ON "User"("referredByUserId");

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_referredByUserId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_referredByUserId_fkey"
  FOREIGN KEY ("referredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" DROP CONSTRAINT IF EXISTS "User_referralTierId_fkey";
ALTER TABLE "User" ADD CONSTRAINT "User_referralTierId_fkey"
  FOREIGN KEY ("referralTierId") REFERENCES "ReferralTier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Backfill referralCode for existing users (first 4 chars of id + last 4, uppercased)
UPDATE "User"
  SET "referralCode" = UPPER(SUBSTRING(REPLACE(id, '-', ''), 1, 4) || SUBSTRING(REPLACE(id, '-', ''), LENGTH(REPLACE(id, '-', '')) - 3))
  WHERE "referralCode" IS NULL;

-- 5. Extend Order with referral fields
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "referralUserId"         TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "referralDiscountAmount" DECIMAL(10,2);

CREATE INDEX IF NOT EXISTS "Order_referralUserId_idx"
  ON "Order"("referralUserId");

ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_referralUserId_fkey";
ALTER TABLE "Order" ADD CONSTRAINT "Order_referralUserId_fkey"
  FOREIGN KEY ("referralUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. ReferralSettings singleton
CREATE TABLE IF NOT EXISTS "ReferralSettings" (
  "id"                   TEXT          NOT NULL DEFAULT 'singleton',
  "level1Rate"           DECIMAL(5,4)  NOT NULL DEFAULT 0.1000,
  "level2Rate"           DECIMAL(5,4)  NOT NULL DEFAULT 0.0500,
  "level3Rate"           DECIMAL(5,4)  NOT NULL DEFAULT 0.0100,
  "buyerDiscountRate"    DECIMAL(5,4)  NOT NULL DEFAULT 0.0500,
  "buyerDiscountEnabled" BOOLEAN       NOT NULL DEFAULT true,
  "minPayoutAmount"      DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  "lockDays"             INTEGER       NOT NULL DEFAULT 14,
  "isEnabled"            BOOLEAN       NOT NULL DEFAULT true,
  "updatedAt"            TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ReferralSettings" ("id", "updatedAt")
  VALUES ('singleton', NOW())
  ON CONFLICT ("id") DO NOTHING;

-- 7. Default tiers
INSERT INTO "ReferralTier" ("id", "name", "minReferrals", "minEarned", "commissionBonus", "badgeColor", "badgeIcon", "sortOrder")
  VALUES
    (gen_random_uuid()::text, 'Bronze',  0,  0,    0.0000, '#CD7F32', 'ti-medal',   1),
    (gen_random_uuid()::text, 'Silver',  5,  50,   0.0050, '#C0C0C0', 'ti-medal-2', 2),
    (gen_random_uuid()::text, 'Gold',   20, 200,   0.0100, '#FFD700', 'ti-crown',   3),
    (gen_random_uuid()::text, 'Diamond',50, 1000,  0.0200, '#B9F2FF', 'ti-diamond', 4)
  ON CONFLICT DO NOTHING;

-- 8. ReferralCommission table
CREATE TABLE IF NOT EXISTS "ReferralCommission" (
  "id"           TEXT                       NOT NULL,
  "earnerId"     TEXT                       NOT NULL,
  "orderId"      TEXT                       NOT NULL,
  "buyerId"      TEXT                       NOT NULL,
  "level"        INTEGER                    NOT NULL,
  "rate"         DECIMAL(5,4)               NOT NULL,
  "baseAmount"   DECIMAL(10,2)              NOT NULL,
  "amount"       DECIMAL(10,2)              NOT NULL,
  "status"       "ReferralCommissionStatus" NOT NULL DEFAULT 'PENDING',
  "confirmedAt"  TIMESTAMP(3),
  "cancelledAt"  TIMESTAMP(3),
  "cancelReason" TEXT,
  "createdAt"    TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)               NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCommission_earnerId_orderId_key"
  ON "ReferralCommission"("earnerId", "orderId");

CREATE INDEX IF NOT EXISTS "ReferralCommission_earnerId_idx"  ON "ReferralCommission"("earnerId");
CREATE INDEX IF NOT EXISTS "ReferralCommission_orderId_idx"   ON "ReferralCommission"("orderId");
CREATE INDEX IF NOT EXISTS "ReferralCommission_buyerId_idx"   ON "ReferralCommission"("buyerId");
CREATE INDEX IF NOT EXISTS "ReferralCommission_status_idx"    ON "ReferralCommission"("status");

ALTER TABLE "ReferralCommission" DROP CONSTRAINT IF EXISTS "ReferralCommission_earnerId_fkey";
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_earnerId_fkey"
  FOREIGN KEY ("earnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralCommission" DROP CONSTRAINT IF EXISTS "ReferralCommission_orderId_fkey";
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ReferralCommission" DROP CONSTRAINT IF EXISTS "ReferralCommission_buyerId_fkey";
ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_buyerId_fkey"
  FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 9. ReferralPayout table
CREATE TABLE IF NOT EXISTS "ReferralPayout" (
  "id"            TEXT                   NOT NULL,
  "userId"        TEXT                   NOT NULL,
  "amount"        DECIMAL(10,2)          NOT NULL,
  "status"        "ReferralPayoutStatus" NOT NULL DEFAULT 'REQUESTED',
  "paymentMethod" TEXT                   NOT NULL,
  "paymentDetail" TEXT                   NOT NULL,
  "adminNotes"    TEXT,
  "processedAt"   TIMESTAMP(3),
  "processedById" TEXT,
  "createdAt"     TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3)           NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralPayout_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReferralPayout_userId_idx"  ON "ReferralPayout"("userId");
CREATE INDEX IF NOT EXISTS "ReferralPayout_status_idx"  ON "ReferralPayout"("status");

ALTER TABLE "ReferralPayout" DROP CONSTRAINT IF EXISTS "ReferralPayout_userId_fkey";
ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
