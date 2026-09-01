ALTER TABLE "PlatformSettings"
ADD COLUMN "freeShippingThreshold" DECIMAL(10,2) NOT NULL DEFAULT 100.00;

ALTER TABLE "Order"
ADD COLUMN "shippingSubsidy" DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE "StoreOrder"
ADD COLUMN "shippingSubsidy" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Finance reports only scan subsidised parcels, ordered by checkout date.
-- A partial index keeps the common zero-subsidy rows out of the index.
CREATE INDEX "StoreOrder_shippingSubsidy_createdAt_idx"
ON "StoreOrder" ("createdAt" DESC)
WHERE "shippingSubsidy" > 0;
