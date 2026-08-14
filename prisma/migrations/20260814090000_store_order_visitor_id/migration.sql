-- Offsite Ads "indirect traffic" — lets checkout persist the buyer's
-- tracking cookie so a later stats query can cross-reference an
-- external-referrer click logged on a DIFFERENT store's page against a
-- purchase made at THIS store.

-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN "visitorId" TEXT;

-- CreateIndex
CREATE INDEX "StoreOrder_visitorId_idx" ON "StoreOrder"("visitorId");
