-- Marketplace Insights (Phase 3): category-scoped trending. Dominant category
-- slug among a search's matching results (not an explicit filter — inferred
-- so trending can be split by category even for unfiltered free-text searches).

-- AlterTable
ALTER TABLE "SearchTermDailyStat" ADD COLUMN "category" TEXT;

-- CreateIndex
CREATE INDEX "SearchTermDailyStat_category_date_idx" ON "SearchTermDailyStat"("category", "date");
