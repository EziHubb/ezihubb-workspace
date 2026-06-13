-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "defaultProcessingDays" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "freeShippingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "freeShippingMinAmount" DECIMAL(10,2) NOT NULL DEFAULT 50.00,
ADD COLUMN     "freeShippingZoneIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "showCarrierInCheckout" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "showEstimatedDelivery" BOOLEAN NOT NULL DEFAULT true;
