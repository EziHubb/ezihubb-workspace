-- Ezihubb Plus: paid feature gate. Phase 1 — manual SUPER_ADMIN grant only,
-- no payment gateway wired up yet (paymentProvider defaults to 'MANUAL').
-- Purely additive: 2 new enums, 2 new nullable/defaulted columns on the
-- existing PlatformSettings singleton row, 1 new table. No DROP, no RENAME,
-- no NOT NULL column added without a DEFAULT.

-- CreateEnum
CREATE TYPE "StoreSubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED');
CREATE TYPE "StoreSubscriptionCycle" AS ENUM ('MONTHLY', 'ANNUAL');

-- AlterTable: PlatformSettings — list price for Plus (editable in admin).
-- plusMonthlyPrice is NOT NULL but carries a DEFAULT, so the existing
-- singleton row is backfilled safely. plusAnnualPrice stays nullable until
-- a real annual price is confirmed — granting an ANNUAL subscription while
-- this is NULL is rejected at the application layer, not the DB.
ALTER TABLE "PlatformSettings"
  ADD COLUMN "plusMonthlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 5.00,
  ADD COLUMN "plusAnnualPrice"  DECIMAL(10,2);

-- CreateTable
CREATE TABLE "StoreSubscription" (
    "id"                     TEXT NOT NULL,
    "storeId"                TEXT NOT NULL,
    "status"                 "StoreSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "cycle"                  "StoreSubscriptionCycle" NOT NULL,
    "priceAtPurchase"        DECIMAL(10,2) NOT NULL,
    "currentPeriodStart"     TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd"       TIMESTAMP(3) NOT NULL,
    "cancelAtPeriodEnd"      BOOLEAN NOT NULL DEFAULT false,
    "cancelledAt"            TIMESTAMP(3),
    "paymentProvider"        TEXT DEFAULT 'MANUAL',
    "externalSubscriptionId" TEXT,
    "grantedByUserId"        TEXT,
    "createdAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"              TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreSubscription_storeId_key" ON "StoreSubscription"("storeId");
CREATE INDEX "StoreSubscription_status_currentPeriodEnd_idx" ON "StoreSubscription"("status", "currentPeriodEnd");
CREATE INDEX "StoreSubscription_grantedByUserId_idx" ON "StoreSubscription"("grantedByUserId");

-- AddForeignKey
ALTER TABLE "StoreSubscription" ADD CONSTRAINT "StoreSubscription_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreSubscription" ADD CONSTRAINT "StoreSubscription_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
