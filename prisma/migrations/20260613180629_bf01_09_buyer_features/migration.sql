-- CreateEnum
CREATE TYPE "CoinTxType" AS ENUM ('PURCHASE', 'PURCHASE_FLASH_DEAL', 'PURCHASE_BUNDLE', 'REVIEW_TEXT', 'REVIEW_PHOTO', 'REFERRAL_BUYER', 'GIFT_CONTRIBUTION', 'DELIVERY_BONUS', 'BIRTHDAY_BONUS', 'FIRST_PURCHASE', 'PROFILE_COMPLETE', 'REDEEM', 'REDEEM_SHIPPING', 'REDEEM_FAN_MEMBERSHIP', 'REDEEM_VIP_UPGRADE', 'EXPIRY', 'ADMIN_ADJUSTMENT', 'BONUS_EVENT', 'REFUND_DEDUCTION', 'CHAIN_INITIATOR', 'CHAIN_RELAY');

-- CreateEnum
CREATE TYPE "TrackingStage" AS ENUM ('ORDER_CONFIRMED', 'SENT_TO_FULFILLMENT', 'IN_PRODUCTION', 'QUALITY_CHECK', 'PACKAGED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED');

-- CreateEnum
CREATE TYPE "FlashDealStatus" AS ENUM ('PENDING', 'APPROVED', 'ACTIVE', 'ENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "VipTier" AS ENUM ('NONE', 'SILVER', 'GOLD');

-- CreateEnum
CREATE TYPE "GiftPoolStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "GiftChainStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "BlindMatchStatus" AS ENUM ('PENDING', 'MATCHED', 'ORDERED', 'DELIVERED', 'REVEALED');

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "storeId" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "coinDiscountAmt" DECIMAL(10,2),
ADD COLUMN     "coinsRedeemed" INTEGER,
ADD COLUMN     "flashDealId" TEXT;

-- CreateTable
CREATE TABLE "BuyerCoinBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "availableCoins" INTEGER NOT NULL DEFAULT 0,
    "pendingCoins" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeRedeemed" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerCoinBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CoinTxType" NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "note" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isExpired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoinBonusEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinBonusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderTracking" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "currentStage" "TrackingStage" NOT NULL DEFAULT 'ORDER_CONFIRMED',
    "carrierTrackingNumber" TEXT,
    "carrierName" TEXT,
    "estimatedDeliveryMin" TIMESTAMP(3),
    "estimatedDeliveryMax" TIMESTAMP(3),
    "printifyOrderId" TEXT,
    "lastPolledAt" TIMESTAMP(3),
    "rawCarrierData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderTracking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackingEvent" (
    "id" TEXT NOT NULL,
    "trackingId" TEXT NOT NULL,
    "stage" "TrackingStage" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashDeal" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "originalPrice" DECIMAL(10,2) NOT NULL,
    "dealPrice" DECIMAL(10,2) NOT NULL,
    "discountPct" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "quantityLimit" INTEGER,
    "soldCount" INTEGER NOT NULL DEFAULT 0,
    "status" "FlashDealStatus" NOT NULL DEFAULT 'PENDING',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlashDeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashDealOrder" (
    "id" TEXT NOT NULL,
    "flashDealId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "coinsEarned" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlashDealOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BundleDiscount" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "itemsCount" INTEGER NOT NULL,
    "discountPct" INTEGER NOT NULL,
    "discountAmount" DECIMAL(10,2) NOT NULL,
    "sellerShare" DECIMAL(10,2) NOT NULL,
    "platformShare" DECIMAL(10,2) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BundleDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreBundleSettings" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minBundleValue" DECIMAL(10,2) NOT NULL DEFAULT 30.00,
    "tier2Discount" INTEGER NOT NULL DEFAULT 15,
    "tier3Discount" INTEGER NOT NULL DEFAULT 20,
    "tier4PlusDiscount" INTEGER NOT NULL DEFAULT 25,
    "excludedProductIds" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreBundleSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BuyerVipStatus" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tier" "VipTier" NOT NULL DEFAULT 'NONE',
    "qualifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "gracePeriodEndsAt" TIMESTAMP(3),
    "qualificationMethod" TEXT,
    "currentCoins90d" INTEGER NOT NULL DEFAULT 0,
    "currentGmv90d" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BuyerVipStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VipExclusiveProduct" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tierRequired" "VipTier" NOT NULL,
    "quantityLimit" INTEGER NOT NULL,
    "quantitySold" INTEGER NOT NULL DEFAULT 0,
    "availableFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VipExclusiveProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftPool" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "shippingAddress" JSONB NOT NULL,
    "targetAmount" DECIMAL(10,2) NOT NULL,
    "collectedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "processingFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deadline" TIMESTAMP(3) NOT NULL,
    "giftMessage" TEXT,
    "shareToken" TEXT NOT NULL,
    "status" "GiftPoolStatus" NOT NULL DEFAULT 'ACTIVE',
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftPool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftContribution" (
    "id" TEXT NOT NULL,
    "giftPoolId" TEXT NOT NULL,
    "contributorId" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "stripePaymentId" TEXT NOT NULL,
    "coinsEarned" INTEGER NOT NULL DEFAULT 0,
    "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "contributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftFinderSession" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT,
    "quizAnswers" JSONB NOT NULL,
    "recommendedProducts" JSONB NOT NULL,
    "convertedToOrder" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftFinderSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftChain" (
    "id" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "initialProductId" TEXT NOT NULL,
    "status" "GiftChainStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "totalLinks" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "GiftChain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftChainLink" (
    "id" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "recipientId" TEXT,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "message" TEXT,
    "linkPosition" INTEGER NOT NULL,
    "discountApplied" BOOLEAN NOT NULL DEFAULT false,
    "continuedChain" BOOLEAN NOT NULL DEFAULT false,
    "nudgeSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftChainLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftChainReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "chainId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "coinsEarned" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftChainReward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlindMatchRequest" (
    "id" TEXT NOT NULL,
    "buyerId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "shippingAddress" JSONB NOT NULL,
    "niche" TEXT[],
    "personality" TEXT NOT NULL,
    "budgetMin" DECIMAL(10,2) NOT NULL,
    "budgetMax" DECIMAL(10,2) NOT NULL,
    "occasion" TEXT NOT NULL,
    "giftMessage" TEXT,
    "selectedProductId" TEXT,
    "curationFee" DECIMAL(10,2) NOT NULL DEFAULT 2.99,
    "aiConfidenceScore" DOUBLE PRECISION,
    "orderId" TEXT,
    "status" "BlindMatchStatus" NOT NULL DEFAULT 'PENDING',
    "buyerRevealed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlindMatchRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlindMatchRating" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "recipientId" TEXT,
    "rating" INTEGER NOT NULL,
    "feedbackText" TEXT,
    "ratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "buyerRefundIssued" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BlindMatchRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BlindMatchAuditLog" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "aiModelVersion" TEXT NOT NULL,
    "candidateProducts" JSONB NOT NULL,
    "selectedProductId" TEXT NOT NULL,
    "selectionReason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlindMatchAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BuyerCoinBalance_userId_key" ON "BuyerCoinBalance"("userId");

-- CreateIndex
CREATE INDEX "CoinTransaction_userId_createdAt_idx" ON "CoinTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CoinTransaction_userId_expiresAt_idx" ON "CoinTransaction"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "CoinTransaction_type_idx" ON "CoinTransaction"("type");

-- CreateIndex
CREATE INDEX "CoinBonusEvent_startsAt_endsAt_idx" ON "CoinBonusEvent"("startsAt", "endsAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderTracking_orderId_key" ON "OrderTracking"("orderId");

-- CreateIndex
CREATE INDEX "TrackingEvent_trackingId_idx" ON "TrackingEvent"("trackingId");

-- CreateIndex
CREATE INDEX "FlashDeal_status_startsAt_endsAt_idx" ON "FlashDeal"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "FlashDeal_storeId_idx" ON "FlashDeal"("storeId");

-- CreateIndex
CREATE INDEX "FlashDeal_productId_idx" ON "FlashDeal"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "FlashDealOrder_orderId_key" ON "FlashDealOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "BundleDiscount_orderId_key" ON "BundleDiscount"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "StoreBundleSettings_storeId_key" ON "StoreBundleSettings"("storeId");

-- CreateIndex
CREATE UNIQUE INDEX "BuyerVipStatus_userId_key" ON "BuyerVipStatus"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VipExclusiveProduct_productId_key" ON "VipExclusiveProduct"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftPool_shareToken_key" ON "GiftPool"("shareToken");

-- CreateIndex
CREATE UNIQUE INDEX "GiftPool_orderId_key" ON "GiftPool"("orderId");

-- CreateIndex
CREATE INDEX "GiftPool_shareToken_idx" ON "GiftPool"("shareToken");

-- CreateIndex
CREATE INDEX "GiftPool_organizerId_idx" ON "GiftPool"("organizerId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftContribution_stripePaymentId_key" ON "GiftContribution"("stripePaymentId");

-- CreateIndex
CREATE INDEX "GiftFinderSession_buyerId_idx" ON "GiftFinderSession"("buyerId");

-- CreateIndex
CREATE INDEX "GiftChain_status_idx" ON "GiftChain"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GiftChainLink_orderId_key" ON "GiftChainLink"("orderId");

-- CreateIndex
CREATE INDEX "GiftChainLink_chainId_idx" ON "GiftChainLink"("chainId");

-- CreateIndex
CREATE INDEX "GiftChainLink_recipientEmail_idx" ON "GiftChainLink"("recipientEmail");

-- CreateIndex
CREATE UNIQUE INDEX "BlindMatchRequest_orderId_key" ON "BlindMatchRequest"("orderId");

-- CreateIndex
CREATE INDEX "BlindMatchRequest_buyerId_idx" ON "BlindMatchRequest"("buyerId");

-- CreateIndex
CREATE INDEX "Order_flashDealId_idx" ON "Order"("flashDealId");

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_flashDealId_fkey" FOREIGN KEY ("flashDealId") REFERENCES "FlashDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerCoinBalance" ADD CONSTRAINT "BuyerCoinBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderTracking" ADD CONSTRAINT "OrderTracking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_trackingId_fkey" FOREIGN KEY ("trackingId") REFERENCES "OrderTracking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashDeal" ADD CONSTRAINT "FlashDeal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashDeal" ADD CONSTRAINT "FlashDeal_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashDealOrder" ADD CONSTRAINT "FlashDealOrder_flashDealId_fkey" FOREIGN KEY ("flashDealId") REFERENCES "FlashDeal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlashDealOrder" ADD CONSTRAINT "FlashDealOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BundleDiscount" ADD CONSTRAINT "BundleDiscount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoreBundleSettings" ADD CONSTRAINT "StoreBundleSettings_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BuyerVipStatus" ADD CONSTRAINT "BuyerVipStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VipExclusiveProduct" ADD CONSTRAINT "VipExclusiveProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftPool" ADD CONSTRAINT "GiftPool_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftPool" ADD CONSTRAINT "GiftPool_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftPool" ADD CONSTRAINT "GiftPool_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftContribution" ADD CONSTRAINT "GiftContribution_giftPoolId_fkey" FOREIGN KEY ("giftPoolId") REFERENCES "GiftPool"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftContribution" ADD CONSTRAINT "GiftContribution_contributorId_fkey" FOREIGN KEY ("contributorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftFinderSession" ADD CONSTRAINT "GiftFinderSession_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftChain" ADD CONSTRAINT "GiftChain_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftChain" ADD CONSTRAINT "GiftChain_initialProductId_fkey" FOREIGN KEY ("initialProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftChainLink" ADD CONSTRAINT "GiftChainLink_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "GiftChain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftChainLink" ADD CONSTRAINT "GiftChainLink_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftChainLink" ADD CONSTRAINT "GiftChainLink_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftChainLink" ADD CONSTRAINT "GiftChainLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftChainLink" ADD CONSTRAINT "GiftChainLink_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftChainReward" ADD CONSTRAINT "GiftChainReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftChainReward" ADD CONSTRAINT "GiftChainReward_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "GiftChain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindMatchRequest" ADD CONSTRAINT "BlindMatchRequest_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindMatchRequest" ADD CONSTRAINT "BlindMatchRequest_selectedProductId_fkey" FOREIGN KEY ("selectedProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindMatchRequest" ADD CONSTRAINT "BlindMatchRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindMatchRating" ADD CONSTRAINT "BlindMatchRating_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BlindMatchRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindMatchRating" ADD CONSTRAINT "BlindMatchRating_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlindMatchAuditLog" ADD CONSTRAINT "BlindMatchAuditLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BlindMatchRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
