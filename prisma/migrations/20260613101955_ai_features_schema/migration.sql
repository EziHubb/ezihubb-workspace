/*
  Warnings:

  - Added the required column `updatedAt` to the `ABPricingTest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "ABTestStatus" ADD VALUE 'INSUFFICIENT_DATA';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CreatorDNAStatus" ADD VALUE 'FETCHING_SOCIAL';
ALTER TYPE "CreatorDNAStatus" ADD VALUE 'ANALYZING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TrendDraftStatus" ADD VALUE 'PENDING_GENERATION';
ALTER TYPE "TrendDraftStatus" ADD VALUE 'GENERATING_BRIEF';
ALTER TYPE "TrendDraftStatus" ADD VALUE 'GENERATING_IMAGE';

-- AlterTable
ALTER TABLE "ABPricingTest" ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "conversionLiftPct" DOUBLE PRECISION,
ADD COLUMN     "recommendation" JSONB,
ADD COLUMN     "recommendedBy" TEXT,
ADD COLUMN     "storeId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "CreatorDNAAnalysis" ADD COLUMN     "draftsGenerated" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "postsAnalyzed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "TrendProductDraft" ADD COLUMN     "briefJobId" TEXT,
ADD COLUMN     "imageJobId" TEXT,
ADD COLUMN     "ipScanStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "suggestedCategoryId" TEXT,
ADD COLUMN     "suggestedPrice" DECIMAL(10,2),
ADD COLUMN     "trendDataSnapshot" JSONB,
ADD COLUMN     "trendPlatform" TEXT NOT NULL DEFAULT 'tiktok';

-- CreateTable
CREATE TABLE "PricingAnalyticsLog" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "currentPrice" DECIMAL(10,2) NOT NULL,
    "recommendedPrice" DECIMAL(10,2) NOT NULL,
    "minPrice" DECIMAL(10,2) NOT NULL,
    "maxPrice" DECIMAL(10,2) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "reasoning" TEXT NOT NULL,
    "competitorData" JSONB,
    "testCreated" BOOLEAN NOT NULL DEFAULT false,
    "testId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingAnalyticsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PricingAnalyticsLog_productId_idx" ON "PricingAnalyticsLog"("productId");

-- CreateIndex
CREATE INDEX "PricingAnalyticsLog_storeId_idx" ON "PricingAnalyticsLog"("storeId");
