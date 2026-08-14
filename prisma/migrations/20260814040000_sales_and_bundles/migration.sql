-- Etsy-parity Marketing: shop-wide/listing auto-apply sales ("Set up a sale")
-- and bundle "buy them together" offers.

-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('SHOP_WIDE', 'SPECIFIC_LISTINGS');

-- AlterTable: relax Promotion.code to nullable (auto-apply sales have no buyer code)
ALTER TABLE "Promotion" ALTER COLUMN "code" DROP NOT NULL;

-- AlterTable: new Promotion fields
ALTER TABLE "Promotion"
  ADD COLUMN "autoApply" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "scope" "PromotionScope" NOT NULL DEFAULT 'SHOP_WIDE',
  ADD COLUMN "country" VARCHAR(2),
  ADD COLUMN "termsAndConditions" TEXT,
  ADD COLUMN "targetUserId" TEXT;

-- CreateIndex
CREATE INDEX "Promotion_autoApply_idx" ON "Promotion"("autoApply");

-- CreateTable
CREATE TABLE "PromotionProduct" (
    "id"          TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "productId"   TEXT NOT NULL,

    CONSTRAINT "PromotionProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromotionProduct_promotionId_productId_key" ON "PromotionProduct"("promotionId", "productId");
CREATE INDEX "PromotionProduct_productId_idx" ON "PromotionProduct"("productId");

-- AddForeignKey
ALTER TABLE "PromotionProduct" ADD CONSTRAINT "PromotionProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PromotionProduct" ADD CONSTRAINT "PromotionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BundleOffer" (
    "id"              TEXT NOT NULL,
    "storeId"         TEXT NOT NULL,
    "discountPercent" DECIMAL(5,2) NOT NULL,
    "isActive"        BOOLEAN NOT NULL DEFAULT true,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BundleOffer_storeId_idx" ON "BundleOffer"("storeId");
CREATE INDEX "BundleOffer_isActive_idx" ON "BundleOffer"("isActive");

-- AddForeignKey
ALTER TABLE "BundleOffer" ADD CONSTRAINT "BundleOffer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BundleOfferProduct" (
    "id"            TEXT NOT NULL,
    "bundleOfferId" TEXT NOT NULL,
    "productId"     TEXT NOT NULL,

    CONSTRAINT "BundleOfferProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BundleOfferProduct_bundleOfferId_productId_key" ON "BundleOfferProduct"("bundleOfferId", "productId");
CREATE INDEX "BundleOfferProduct_productId_idx" ON "BundleOfferProduct"("productId");

-- AddForeignKey
ALTER TABLE "BundleOfferProduct" ADD CONSTRAINT "BundleOfferProduct_bundleOfferId_fkey" FOREIGN KEY ("bundleOfferId") REFERENCES "BundleOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BundleOfferProduct" ADD CONSTRAINT "BundleOfferProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
