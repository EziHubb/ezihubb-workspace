-- Buyer-facing physical dimensions (Etsy Item Details "Width"/"Height"
-- attributes) — distinct from shipping-package dimensions, which don't
-- exist anywhere in this schema; ShippingProfile is flat/fixed-rate only.

-- CreateEnum
CREATE TYPE "DimensionUnit" AS ENUM ('CM', 'IN', 'MM', 'M');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "width" DECIMAL(8,2),
ADD COLUMN "height" DECIMAL(8,2),
ADD COLUMN "dimensionUnit" "DimensionUnit";
