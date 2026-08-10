-- Fulfillment order pushes to Merchize were sending the same finished mockup
-- photo as both the preview image AND the actual print/design artwork field
-- (design_front), because ProductImage had no concept of a distinct
-- print-ready file. This adds an optional, backward-compatible discriminator:
-- every existing row defaults to MOCKUP (unchanged behavior for every current
-- caller), and sellers can now separately generate/upload an isolated
-- PRINT_FILE per print side, used only when pushing an order to a provider.
CREATE TYPE "ProductImageType" AS ENUM ('MOCKUP', 'PRINT_FILE');
CREATE TYPE "PrintSide" AS ENUM ('FRONT', 'BACK', 'SLEEVE', 'HOOD');

ALTER TABLE "ProductImage" ADD COLUMN "type" "ProductImageType" NOT NULL DEFAULT 'MOCKUP';
ALTER TABLE "ProductImage" ADD COLUMN "printSide" "PrintSide";

CREATE INDEX "ProductImage_productId_type_printSide_idx" ON "ProductImage"("productId", "type", "printSide");
