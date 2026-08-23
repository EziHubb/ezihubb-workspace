-- Seller-defined order workflow.
--
-- StoreOrder.status stays as it is: it is what the platform knows about an
-- order — paid, cancelled, refunded, disputed — and money and buyer emails
-- hang off it. The new table is what the SELLER knows, in their own words.
-- Only the last step crosses back over, by completing the order.

-- CreateEnum
CREATE TYPE "OrderProgressStepKind" AS ENUM ('NEW', 'CUSTOM', 'COMPLETED');

-- AlterTable
ALTER TABLE "StoreOrder" ADD COLUMN     "progressStepId" TEXT,
ADD COLUMN     "shipByDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrderProgressStep" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "kind" "OrderProgressStepKind" NOT NULL DEFAULT 'CUSTOM',
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderProgressStep_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderProgressStep_storeId_sortOrder_idx" ON "OrderProgressStep"("storeId", "sortOrder");

-- CreateIndex
CREATE INDEX "StoreOrder_storeId_shipByDate_idx" ON "StoreOrder"("storeId", "shipByDate");

-- CreateIndex
CREATE INDEX "StoreOrder_progressStepId_idx" ON "StoreOrder"("progressStepId");

-- AddForeignKey
ALTER TABLE "StoreOrder" ADD CONSTRAINT "StoreOrder_progressStepId_fkey" FOREIGN KEY ("progressStepId") REFERENCES "OrderProgressStep"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderProgressStep" ADD CONSTRAINT "OrderProgressStep_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ── Backfill ───────────────────────────────────────────────────────────────
-- Every existing shop gets the two locked ends. sortOrder leaves room between
-- them so custom steps can be inserted without renumbering these two.

INSERT INTO "OrderProgressStep" ("id", "storeId", "name", "kind", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'New',       'NEW',       0,    NOW(), NOW() FROM "Store" s;

INSERT INTO "OrderProgressStep" ("id", "storeId", "name", "kind", "sortOrder", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, s."id", 'Completed', 'COMPLETED', 1000, NOW(), NOW() FROM "Store" s;

-- Place existing orders. Anything the platform already considers finished
-- starts on the last step; anything else that has been paid for starts on the
-- first. Unpaid orders are left off the pipeline entirely — they are not work
-- yet, and the seller's queue should not show them.

UPDATE "StoreOrder" so
SET "progressStepId" = p."id"
FROM "OrderProgressStep" p
WHERE p."storeId" = so."storeId"
  AND p."kind"    = 'COMPLETED'
  AND so."status" IN ('COMPLETED', 'DELIVERED');

UPDATE "StoreOrder" so
SET "progressStepId" = p."id"
FROM "OrderProgressStep" p
WHERE p."storeId" = so."storeId"
  AND p."kind"    = 'NEW'
  AND so."progressStepId" IS NULL
  AND so."status" NOT IN ('PENDING_PAYMENT', 'CANCELLED', 'REFUNDED');

-- shipByDate is deliberately NOT backfilled. Nobody recorded what these
-- orders were promised, and inventing a date would make the "Overdue" filter
-- lie about commitments that were never made. They read as "No estimate",
-- which is a real bucket in the filter list.
