-- Full removal of the legacy platform-wide ShippingZone/ShippingMethod rate
-- table. Superseded end-to-end by seller-owned Delivery profiles
-- (ShippingProfile/ShippingProfileMethod) — every physical listing has
-- required one since the 20260813190000_delivery_settings migration, and
-- checkout/cart estimate no longer have a fallback path onto Zones. The six
-- PlatformSettings shipping fields below were only ever read/written by the
-- admin Zone settings page being removed alongside this — never consumed by
-- checkout or cart logic.

-- DropForeignKey
ALTER TABLE "ShippingMethod" DROP CONSTRAINT "ShippingMethod_zoneId_fkey";

-- DropTable
DROP TABLE "ShippingMethod";

-- DropTable
DROP TABLE "ShippingZone";

-- AlterTable
ALTER TABLE "PlatformSettings" DROP COLUMN "freeShippingEnabled",
DROP COLUMN "freeShippingMinAmount",
DROP COLUMN "freeShippingZoneIds",
DROP COLUMN "defaultProcessingDays",
DROP COLUMN "showEstimatedDelivery",
DROP COLUMN "showCarrierInCheckout";
