-- Etsy-parity Marketing: Share & Save + Offsite Ads shared attribution model.

-- AlterEnum
ALTER TYPE "SellerLedgerEntryType" ADD VALUE 'SHARE_SAVE_REFUND';
ALTER TYPE "SellerLedgerEntryType" ADD VALUE 'OFFSITE_ADS_FEE';

-- CreateEnum
CREATE TYPE "LinkClickKind" AS ENUM ('SHARE_SAVE', 'OFFSITE_AD');

-- AlterTable: Store
ALTER TABLE "Store"
  ADD COLUMN "shareSaveEnabled"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shareSaveJoinedAt"  TIMESTAMP(3),
  ADD COLUMN "offsiteAdsOptedOut" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: PlatformSettings
ALTER TABLE "PlatformSettings"
  ADD COLUMN "offsiteAdsFeeRate" DECIMAL(5,4) NOT NULL DEFAULT 0.15;

-- CreateTable
CREATE TABLE "StoreLinkClick" (
    "id"          TEXT NOT NULL,
    "storeId"     TEXT NOT NULL,
    "kind"        "LinkClickKind" NOT NULL,
    "visitorId"   TEXT NOT NULL,
    "productId"   TEXT,
    "source"      TEXT,
    "convertedAt" TIMESTAMP(3),
    "orderId"     TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreLinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StoreLinkClick_storeId_kind_createdAt_idx" ON "StoreLinkClick"("storeId", "kind", "createdAt");
CREATE INDEX "StoreLinkClick_visitorId_createdAt_idx" ON "StoreLinkClick"("visitorId", "createdAt");

-- AddForeignKey
ALTER TABLE "StoreLinkClick" ADD CONSTRAINT "StoreLinkClick_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
