-- Marketplace Insights (Phase 0): search-term attribution + durable daily stats.
--
-- searchTerm on CartItem/OrderItem carries the keyword that led a buyer to a
-- product (via ?st= on the product link) through to checkout, so purchases
-- can be attributed back to a search term for conversion-rate reporting.
-- SearchTermDailyStat is the durable (90-day) history flushed nightly from
-- Redis — see AnalyticsService.flushDailySearchStats.

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN "searchTerm" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "searchTerm" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "SearchTermDailyStat" (
    "id" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "searches" INTEGER NOT NULL DEFAULT 0,
    "resultsCount" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchTermDailyStat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SearchTermDailyStat_date_idx" ON "SearchTermDailyStat"("date");

-- CreateIndex
CREATE UNIQUE INDEX "SearchTermDailyStat_term_date_key" ON "SearchTermDailyStat"("term", "date");
