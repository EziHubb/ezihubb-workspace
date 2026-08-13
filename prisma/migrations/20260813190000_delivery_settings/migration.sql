-- Etsy-parity "Delivery settings": seller-owned processing schedule, plus
-- per-store ProcessingProfile/ShippingProfile with origin + per-row charge
-- type, replacing the profile-level "type" field with a per-destination-row
-- ShippingChargeType (Fixed / Free) to match Etsy's per-row "What you'll
-- charge" control.

-- CreateEnum
CREATE TYPE "ShippingChargeType" AS ENUM ('FIXED', 'FREE');

-- AlterTable: Store — order processing schedule (Mon-Fri always on, not stored)
-- + shop-level delivery-upgrades toggle
ALTER TABLE "Store" ADD COLUMN "processesOnSaturday" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "processesOnSunday" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "deliveryUpgradesEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: ProcessingProfile — now seller-owned (nullable storeId; legacy
-- platform-default rows keep storeId = NULL)
ALTER TABLE "ProcessingProfile" ADD COLUMN "storeId" TEXT;

CREATE INDEX "ProcessingProfile_storeId_idx" ON "ProcessingProfile"("storeId");

ALTER TABLE "ProcessingProfile" ADD CONSTRAINT "ProcessingProfile_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: ShippingProfile — drop the profile-level charge "type" (moved
-- to ShippingProfileMethod, per-row), add origin dispatch fields
ALTER TABLE "ShippingProfile" DROP COLUMN "type",
ADD COLUMN "originCountry" VARCHAR(2) NOT NULL DEFAULT 'VN',
ADD COLUMN "originPostalCode" TEXT NOT NULL DEFAULT '';

-- AlterTable: ShippingProfileMethod
-- 1) add the new named-carrier columns, backfilling carrierName from the old
--    free-text "carrier" column so no existing data is lost
ALTER TABLE "ShippingProfileMethod" ADD COLUMN "carrierService" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN "carrierName" TEXT,
ADD COLUMN "chargeType" "ShippingChargeType" NOT NULL DEFAULT 'FIXED';

UPDATE "ShippingProfileMethod" SET "carrierName" = "carrier" WHERE "carrier" IS NOT NULL;

ALTER TABLE "ShippingProfileMethod" DROP COLUMN "carrier";

-- 2) price becomes nullable — a FREE row carries a destination/SLA but no cost
ALTER TABLE "ShippingProfileMethod" ALTER COLUMN "price" DROP NOT NULL;
