-- Etsy-parity Marketing: automated targeted offers (Interested shopper,
-- Thank you, Abandoned basket, Favourited item).

-- CreateEnum
CREATE TYPE "TargetedOfferTrigger" AS ENUM ('INTERESTED_SHOPPER', 'THANK_YOU', 'ABANDONED_BASKET', 'FAVOURITED_ITEM');

-- CreateIndex (targetUserId column already exists from 20260814040000)
CREATE INDEX "Promotion_targetUserId_idx" ON "Promotion"("targetUserId");

-- CreateTable
CREATE TABLE "TargetedOfferCampaign" (
    "id"               TEXT NOT NULL,
    "storeId"          TEXT NOT NULL,
    "trigger"          "TargetedOfferTrigger" NOT NULL,
    "discountType"     "DiscountType" NOT NULL,
    "discountValue"    DECIMAL(10,2) NOT NULL,
    "expiresAfterDays" INTEGER NOT NULL DEFAULT 3,
    "lookbackDays"     INTEGER NOT NULL DEFAULT 7,
    "isActive"         BOOLEAN NOT NULL DEFAULT true,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetedOfferCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TargetedOfferCampaign_storeId_trigger_key" ON "TargetedOfferCampaign"("storeId", "trigger");
CREATE INDEX "TargetedOfferCampaign_isActive_idx" ON "TargetedOfferCampaign"("isActive");

-- AddForeignKey
ALTER TABLE "TargetedOfferCampaign" ADD CONSTRAINT "TargetedOfferCampaign_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
