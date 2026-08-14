-- Etsy-parity Marketing: "Let buyers make offers" (negotiation).

-- CreateEnum
CREATE TYPE "BuyerOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'COUNTERED');
CREATE TYPE "OffersScope" AS ENUM ('ALL_LISTINGS', 'SPECIFIC_LISTINGS');

-- AlterTable: Store
ALTER TABLE "Store"
  ADD COLUMN "offersEnabled"            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "offersScope"              "OffersScope" NOT NULL DEFAULT 'ALL_LISTINGS',
  ADD COLUMN "offersMaxDiscountPercent" DECIMAL(5,2);

-- CreateTable
CREATE TABLE "StoreOfferListing" (
    "id"        TEXT NOT NULL,
    "storeId"   TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    CONSTRAINT "StoreOfferListing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreOfferListing_storeId_productId_key" ON "StoreOfferListing"("storeId", "productId");
CREATE INDEX "StoreOfferListing_productId_idx" ON "StoreOfferListing"("productId");

-- AddForeignKey
ALTER TABLE "StoreOfferListing" ADD CONSTRAINT "StoreOfferListing_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StoreOfferListing" ADD CONSTRAINT "StoreOfferListing_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BuyerOffer" (
    "id"           TEXT NOT NULL,
    "productId"    TEXT NOT NULL,
    "buyerId"      TEXT NOT NULL,
    "storeId"      TEXT NOT NULL,
    "offeredPrice" DECIMAL(10,2) NOT NULL,
    "counterPrice" DECIMAL(10,2),
    "status"       "BuyerOfferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt"    TIMESTAMP(3) NOT NULL,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BuyerOffer_storeId_status_idx" ON "BuyerOffer"("storeId", "status");
CREATE INDEX "BuyerOffer_productId_idx" ON "BuyerOffer"("productId");
CREATE INDEX "BuyerOffer_buyerId_idx" ON "BuyerOffer"("buyerId");

-- AddForeignKey
ALTER TABLE "BuyerOffer" ADD CONSTRAINT "BuyerOffer_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuyerOffer" ADD CONSTRAINT "BuyerOffer_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BuyerOffer" ADD CONSTRAINT "BuyerOffer_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;
